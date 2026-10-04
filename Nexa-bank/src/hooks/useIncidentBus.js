/**
 * useIncidentBus.ts
 *
 * Global Singleton Store tracking live incident state from the Express backend.
 * Uses a single persistent EventSource (GET /api/incidents/stream) with automatic
 * reconnection and polling fallback.
 *
 * All subscribers across the app (AppLayout, OpsPage, SupportPage, TransferPage)
 * share the exact same synchronized state.
 */
import { useEffect, useState } from 'react';
import { connectIncidentStream, getIncidentStatus, getPreAlertStatus, simulateFailure as apiSimulateFailure, autoHeal as apiAutoHeal, } from '@/lib/api';
// ─── Global Singleton Store State ─────────────────────────────────────────────
let globalState = {
    incident: null,
    preAlert: null,
    justResolved: false,
    backendOffline: false,
    lastUpdated: new Date().toISOString(),
};
const listeners = new Set();
let prevIncidentType = null;
let sseConnection = null;
let isInitialized = false;
let resolveTimer = null;
function setGlobalState(updater) {
    globalState = updater(globalState);
    listeners.forEach((listener) => listener(globalState));
}
function applyIncidentUpdate(type, startedAt, severity, etaMinutes, rootCause) {
    const wasActive = prevIncidentType !== null;
    const isNowClear = type === null;
    const justResolved = wasActive && isNowClear;
    prevIncidentType = type;
    if (justResolved) {
        if (resolveTimer)
            clearTimeout(resolveTimer);
        resolveTimer = setTimeout(() => {
            setGlobalState((prev) => ({ ...prev, justResolved: false }));
        }, 8000);
    }
    setGlobalState((prev) => ({
        ...prev,
        backendOffline: false,
        justResolved: justResolved ? true : prev.justResolved && !type,
        lastUpdated: new Date().toISOString(),
        incident: type === null
            ? null
            : {
                type,
                startedAt: startedAt ?? new Date().toISOString(),
                severity: severity ?? 'high',
                rootCause: rootCause ?? 'Analyzing anomalous patterns across telemetry logs...',
                etaMinutes: etaMinutes ?? 10,
                affectedUserCount: 0,
            },
    }));
}
function applyPreAlertUpdate(active, preAlert) {
    setGlobalState((prev) => ({
        ...prev,
        preAlert: active ? preAlert : null,
        lastUpdated: new Date().toISOString(),
    }));
}
// ─── Global Connection Manager ────────────────────────────────────────────────
async function fetchInitialStatus() {
    try {
        const [incRes, preRes] = await Promise.allSettled([
            getIncidentStatus(),
            getPreAlertStatus(),
        ]);
        if (incRes.status === 'fulfilled') {
            const data = incRes.value;
            applyIncidentUpdate(data.incident?.type ?? null, data.incident?.startedAt, data.incident?.severity, data.incident?.etaMinutes, data.incident?.rootCause);
        }
        if (preRes.status === 'fulfilled') {
            applyPreAlertUpdate(preRes.value.active, preRes.value.preAlert);
        }
    }
    catch {
        setGlobalState((prev) => ({ ...prev, backendOffline: true }));
    }
}
function initGlobalBus() {
    if (typeof window === 'undefined' || isInitialized)
        return;
    isInitialized = true;
    fetchInitialStatus();
    try {
        sseConnection = connectIncidentStream((data) => {
            applyIncidentUpdate(data.type, data.startedAt, data.type ? 'high' : undefined, 10);
        }, (data) => {
            applyPreAlertUpdate(data.active, data.preAlert);
        });
        sseConnection.onerror = () => {
            // Re-poll on SSE hiccups
            setTimeout(fetchInitialStatus, 3000);
        };
    }
    catch {
        // Fallback polling
        setInterval(fetchInitialStatus, 6000);
    }
}
// ─── Exported Actions ─────────────────────────────────────────────────────────
export async function triggerIncidentSimulation(type) {
    // Optimistic update
    applyIncidentUpdate(type, new Date().toISOString(), 'high', 10);
    try {
        await apiSimulateFailure(type);
    }
    catch (err) {
        console.error('Failed to trigger simulation on backend:', err);
        fetchInitialStatus();
        throw err;
    }
}
export async function triggerAutoHeal(type) {
    // Optimistic clear
    applyIncidentUpdate(null);
    try {
        await apiAutoHeal(type);
    }
    catch (err) {
        console.error('Failed to trigger auto-heal on backend:', err);
        fetchInitialStatus();
        throw err;
    }
}
export function refreshIncidentBus() {
    fetchInitialStatus();
}
// ─── React Hook ───────────────────────────────────────────────────────────────
export function useIncidentBus() {
    const [state, setState] = useState(globalState);
    useEffect(() => {
        initGlobalBus();
        listeners.add(setState);
        // Sync current state immediately on mount
        setState(globalState);
        return () => {
            listeners.delete(setState);
        };
    }, []);
    return {
        ...state,
        triggerIncident: triggerIncidentSimulation,
        healIncident: triggerAutoHeal,
        refresh: refreshIncidentBus,
    };
}
