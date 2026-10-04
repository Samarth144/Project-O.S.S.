/**
 * api.ts — Centralized API client for Nexa Bank frontend
 *
 * ALL backend communication goes through this module.
 * No page component should ever call fetch() directly.
 *
 * Architecture rule (from README):
 *   Frontend → Express (3000) ONLY
 *   Express → RAG / n8n / Watchdog (never from frontend)
 */
const BASE_URL = 'http://localhost:3000';
// ─── Generic request helper ──────────────────────────────────────────────────
async function request(method, path, body, timeoutMs = 3500) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
    };
    if (body !== undefined) {
        options.body = JSON.stringify(body);
    }
    let res;
    try {
        res = await fetch(`${BASE_URL}${path}`, options);
    }
    catch (err) {
        if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
            throw new ApiError('Express did not respond before the request timed out. Check the backend log; the operation may already have completed.', 504, { timedOut: true });
        }
        throw new ApiError('Backend service is unreachable. Please ensure Express is running.', 503, { backendOffline: true, incidentActive: false });
    }
    if (!res.ok) {
        let errorBody = {};
        try {
            errorBody = await res.clone().json();
        }
        catch {
            /* non-JSON body is fine */
        }
        throw new ApiError(errorBody.reason || errorBody.customerMessage || errorBody.error ||
            'A temporary issue occurred. Please try again shortly.', res.status, errorBody);
    }
    return res.json();
}
// ─── Typed error class ───────────────────────────────────────────────────────
export class ApiError extends Error {
    customerMessage;
    status;
    body;
    constructor(customerMessage, status, body = {}) {
        super(customerMessage);
        this.customerMessage = customerMessage;
        this.status = status;
        this.body = body;
        this.name = 'ApiError';
    }
    get incidentActive() {
        return this.body.incidentActive === true;
    }
    get incidentType() {
        return this.body.incidentType ?? null;
    }
    get etaMinutes() {
        return this.body.etaMinutes ?? 10;
    }
}
// ─── API Methods ─────────────────────────────────────────────────────────────
/**
 * Transfer money — POST /api/banking/transfer
 * Throws ApiError with customerMessage on failure (incident, db issue, etc.)
 */
export async function transferMoney(payload) {
    return request('POST', '/api/banking/transfer', payload);
}
/**
 * Get banking service availability — GET /api/banking/status
 */
export async function getBankingStatus() {
    try {
        return await request('GET', '/api/banking/status');
    }
    catch {
        return { available: false, incident: null, preAlert: null };
    }
}
/**
 * Get active incident status — GET /api/incident/active
 * Used by useIncidentBus for polling.
 */
export async function getIncidentStatus() {
    try {
        return await request('GET', '/api/incident/active');
    }
    catch {
        return { active: false, incident: null };
    }
}
/**
 * Get pre-alert status — GET /api/pre-alert
 * Used by useIncidentBus for polling.
 */
export async function getPreAlertStatus() {
    try {
        return await request('GET', '/api/pre-alert');
    }
    catch {
        return { active: false, preAlert: null };
    }
}
/**
 * Send a message to the Shield AI support agent.
 * Express enriches with RAG context before forwarding to n8n Shield webhook.
 * Customer never sees internal prompts or runbook references.
 * POST /api/shield/chat
 */
export async function sendChatMessage(message) {
    try {
        const data = await request('POST', '/api/shield/chat', { message }, 35000);
        const extractText = (val) => {
            if (!val) return '';
            if (typeof val === 'string') return val;
            if (Array.isArray(val)) return val.length ? extractText(val[0]) : '';
            if (typeof val === 'object') {
                return val.response || val.output || val.message || val.text || val.content || (val.json ? extractText(val.json) : '') || '';
            }
            return String(val);
        };
        return extractText(data) || "I've received your message and I'm looking into it. Please hold on a moment.";
    }
    catch {
        // Empathetic fallback — never expose internal errors
        return "I'm here to help. Our systems are currently active, and our team is monitoring all channels. Please feel free to ask any specific questions about your account or services.";
    }
}
/**
 * Get live metrics from watchdog (proxied through Express).
 * GET /api/metrics → Express → Watchdog port 3100
 */
export async function getMetrics() {
    try {
        return await request('GET', '/api/metrics', undefined, 1000);
    }
    catch {
        return { latest: null, history: [], thresholds: {} };
    }
}
/**
 * Get recent server logs and active incident state (ops dashboard).
 * GET /api/logs
 */
export async function getLogs() {
    try {
        return await request('GET', '/api/logs');
    }
    catch {
        return { activeIncident: { type: null, startedAt: null }, logs: [] };
    }
}
/**
 * Connect to the SSE incident stream for push-based updates.
 * Returns the EventSource — caller must call .close() on unmount.
 *
 * Usage:
 *   const es = connectIncidentStream(onUpdate, onPreAlert);
 *   return () => es.close();
 */
export function connectIncidentStream(onIncidentUpdate, onPreAlertUpdate) {
    const es = new EventSource(`${BASE_URL}/api/incidents/stream`);
    es.addEventListener('init', (e) => {
        try {
            const data = JSON.parse(e.data);
            onIncidentUpdate(data);
            if (data.preAlert !== undefined) {
                onPreAlertUpdate({ active: data.preAlert !== null, preAlert: data.preAlert });
            }
        }
        catch { /* ignore malformed */ }
    });
    es.addEventListener('incident-update', (e) => {
        try {
            onIncidentUpdate(JSON.parse(e.data));
        }
        catch { /* ignore */ }
    });
    es.addEventListener('prealert-update', (e) => {
        try {
            onPreAlertUpdate(JSON.parse(e.data));
        }
        catch { /* ignore */ }
    });
    // EventSource auto-reconnects on error by design
    return es;
}
/**
 * Trigger an incident manually (for testing/ops)
 * POST /simulate-failure
 */
export async function simulateFailure(type) {
    await request('POST', '/simulate-failure', { type });
}
/**
 * Resolve / clear an active incident manually (for testing/ops)
 * POST /resolve-incident
 */
export async function resolveIncident() {
    await request('POST', '/resolve-incident');
}
/**
 * Trigger auto-heal manually (for testing/ops)
 * POST /auto-heal
 */
export async function autoHeal(type) {
    await request('POST', '/auto-heal', { type }, 30000);
}

export async function getPolicy() {
    return request('GET', '/api/policy');
}
export async function getPolicyRecommendation(type) {
    return request('GET', `/api/policy/recommendation?type=${encodeURIComponent(type)}`);
}
export async function trainPolicy(type, episodes = 50) {
    return request('POST', '/api/policy/train', { type, episodes }, 120000);
}
export async function resetPolicy() {
    return request('POST', '/api/policy/reset', {});
}
