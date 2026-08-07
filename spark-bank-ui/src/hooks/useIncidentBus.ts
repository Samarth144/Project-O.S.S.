/**
 * useIncidentBus.ts
 *
 * Global hook that tracks the live incident state from the Express backend.
 * Primary transport: Server-Sent Events (GET /api/incidents/stream).
 * Fallback: polling /api/incident/active + /api/pre-alert every 5s if SSE unavailable.
 *
 * Used by:
 *   - AppLayout (global recovery banner)
 *   - TransferPage (state machine transitions)
 *   - NotificationsPage (injected live notification)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  connectIncidentStream,
  getIncidentStatus,
  getPreAlertStatus,
  type IncidentStatus,
  type PreAlertStatus,
} from '@/lib/api';

export interface IncidentBusState {
  /** Current active incident (null = system healthy) */
  incident: IncidentStatus['incident'] | null;
  /** Pre-alert state (warning before full incident) */
  preAlert: PreAlertStatus['preAlert'] | null;
  /** True when incident just cleared (resolved/auto-healed) */
  justResolved: boolean;
  /** True when Express is unreachable */
  backendOffline: boolean;
}

const POLL_INTERVAL_MS = 5000;
const PREALERT_POLL_INTERVAL_MS = 8000;

export function useIncidentBus(): IncidentBusState {
  const [state, setState] = useState<IncidentBusState>({
    incident: null,
    preAlert: null,
    justResolved: false,
    backendOffline: false,
  });

  const esRef = useRef<EventSource | null>(null);
  const sseConnected = useRef(false);
  const prevIncidentType = useRef<string | null>(null);

  // ── Derive justResolved from incident type transitions ──────────────────────
  const applyIncidentUpdate = useCallback(
    (type: string | null, startedAt?: string, severity?: string, etaMinutes?: number) => {
      const wasActive = prevIncidentType.current !== null;
      const isNowClear = type === null;
      const justResolved = wasActive && isNowClear;
      prevIncidentType.current = type;

      setState((prev) => ({
        ...prev,
        backendOffline: false,
        justResolved,
        incident:
          type === null
            ? null
            : {
                type,
                startedAt: startedAt ?? new Date().toISOString(),
                severity: severity ?? 'high',
                rootCause: '',
                etaMinutes: etaMinutes ?? 10,
                affectedUserCount: 0,
              },
      }));

      // Clear "just resolved" banner after 8s
      if (justResolved) {
        setTimeout(() => {
          setState((prev) => ({ ...prev, justResolved: false }));
        }, 8000);
      }
    },
    [],
  );

  const applyPreAlertUpdate = useCallback(
    (active: boolean, preAlert: PreAlertStatus['preAlert']) => {
      setState((prev) => ({ ...prev, preAlert: active ? preAlert : null }));
    },
    [],
  );

  // ── SSE connection ──────────────────────────────────────────────────────────
  useEffect(() => {
    let pollIncidentTimer: ReturnType<typeof setInterval> | null = null;
    let pollPreAlertTimer: ReturnType<typeof setInterval> | null = null;

    function startPollingFallback() {
      if (sseConnected.current) return;

      const pollIncident = async () => {
        try {
          const data = await getIncidentStatus();
          applyIncidentUpdate(
            data.incident?.type ?? null,
            data.incident?.startedAt,
            data.incident?.severity,
            data.incident?.etaMinutes,
          );
        } catch {
          setState((prev) => ({ ...prev, backendOffline: true }));
        }
      };

      const pollPreAlert = async () => {
        try {
          const data = await getPreAlertStatus();
          applyPreAlertUpdate(data.active, data.preAlert);
        } catch {
          /* silent — incident polling already handles offline state */
        }
      };

      pollIncident();
      pollPreAlert();
      pollIncidentTimer = setInterval(pollIncident, POLL_INTERVAL_MS);
      pollPreAlertTimer = setInterval(pollPreAlert, PREALERT_POLL_INTERVAL_MS);
    }

    function connectSSE() {
      try {
        const es = connectIncidentStream(
          (data) => {
            sseConnected.current = true;
            applyIncidentUpdate(data.type, data.startedAt);
          },
          (data) => {
            applyPreAlertUpdate(data.active, data.preAlert);
          },
        );

        es.onopen = () => {
          sseConnected.current = true;
          // Clear polling timers once SSE is live
          if (pollIncidentTimer) { clearInterval(pollIncidentTimer); pollIncidentTimer = null; }
          if (pollPreAlertTimer) { clearInterval(pollPreAlertTimer); pollPreAlertTimer = null; }
        };

        es.onerror = () => {
          sseConnected.current = false;
          // Fall back to polling if SSE fails
          startPollingFallback();
        };

        esRef.current = es;
      } catch {
        // SSE not available (e.g., test environment) — use polling
        startPollingFallback();
      }
    }

    // Start with SSE, fall back to polling on error
    connectSSE();
    // Also start polling immediately as a safety net until SSE confirms open
    const safetyTimer = setTimeout(() => {
      if (!sseConnected.current) {
        startPollingFallback();
      }
    }, 2000);

    return () => {
      clearTimeout(safetyTimer);
      if (pollIncidentTimer) clearInterval(pollIncidentTimer);
      if (pollPreAlertTimer) clearInterval(pollPreAlertTimer);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      sseConnected.current = false;
    };
  }, [applyIncidentUpdate, applyPreAlertUpdate]);

  return state;
}
