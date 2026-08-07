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

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<T> {
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${path}`, options);
  if (!res.ok) {
    let errorBody: Record<string, unknown> = {};
    try {
      errorBody = await res.clone().json();
    } catch {
      /* non-JSON body is fine */
    }
    throw new ApiError(
      (errorBody.customerMessage as string) ||
        'A temporary issue occurred. Please try again shortly.',
      res.status,
      errorBody,
    );
  }
  return res.json() as Promise<T>;
}

// ─── Typed error class ───────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly customerMessage: string,
    public readonly status: number,
    public readonly body: Record<string, unknown> = {},
  ) {
    super(customerMessage);
    this.name = 'ApiError';
  }

  get incidentActive(): boolean {
    return this.body.incidentActive === true;
  }

  get incidentType(): string | null {
    return (this.body.incidentType as string) ?? null;
  }

  get etaMinutes(): number {
    return (this.body.etaMinutes as number) ?? 10;
  }
}

// ─── Response types ──────────────────────────────────────────────────────────

export interface TransferPayload {
  amount: number;
  fromAccount?: string;
  toAccount?: string;
  beneficiaryId?: string;
  remarks?: string;
  method?: string;
}

export interface TransferResult {
  success: boolean;
  transactionId: string;
  amount: number;
  message: string;
  timestamp: string;
  method: string;
  status: string;
}

export interface BankingStatus {
  available: boolean;
  incident: {
    type: string;
    startedAt: string;
    customerMessage: string;
    etaMinutes: number;
    recoveryUnderway: boolean;
  } | null;
  preAlert: {
    message: string;
    detectedAt: number;
  } | null;
}

export interface IncidentStatus {
  active: boolean;
  incident: {
    type: string;
    startedAt: string;
    severity: string;
    rootCause: string;
    etaMinutes: number;
    affectedUserCount: number;
  } | null;
}

export interface PreAlertStatus {
  active: boolean;
  preAlert: {
    detectedAt: number;
    [key: string]: unknown;
  } | null;
}

export interface ChatResponse {
  response?: string;
  output?: string;
  message?: string;
  text?: string;
}

export interface WatchdogMetrics {
  latest: {
    timestamp: string;
    cpu: number;
    memory: number;
    errorRate: number;
    dbLatency: number | null;
    appHealthy: boolean;
    affectedUsers: number;
    states: Record<string, string>;
  } | null;
  history: Array<{
    timestamp: string;
    cpu: number;
    memory: number;
    errorRate: number;
    dbLatency: number | null;
    appHealthy: boolean;
  }>;
  thresholds: Record<string, unknown>;
}

// ─── API Methods ─────────────────────────────────────────────────────────────

/**
 * Transfer money — POST /api/banking/transfer
 * Throws ApiError with customerMessage on failure (incident, db issue, etc.)
 */
export async function transferMoney(payload: TransferPayload): Promise<TransferResult> {
  return request<TransferResult>('POST', '/api/banking/transfer', payload);
}

/**
 * Get banking service availability — GET /api/banking/status
 */
export async function getBankingStatus(): Promise<BankingStatus> {
  return request<BankingStatus>('GET', '/api/banking/status');
}

/**
 * Get active incident status — GET /api/incident/active
 * Used by useIncidentBus for polling.
 */
export async function getIncidentStatus(): Promise<IncidentStatus> {
  return request<IncidentStatus>('GET', '/api/incident/active');
}

/**
 * Get pre-alert status — GET /api/pre-alert
 * Used by useIncidentBus for polling.
 */
export async function getPreAlertStatus(): Promise<PreAlertStatus> {
  return request<PreAlertStatus>('GET', '/api/pre-alert');
}

/**
 * Send a message to the Shield AI support agent.
 * Express enriches with RAG context before forwarding to n8n Shield webhook.
 * Customer never sees internal prompts or runbook references.
 * POST /api/shield/chat
 */
export async function sendChatMessage(message: string): Promise<string> {
  try {
    const data = await request<ChatResponse>('POST', '/api/shield/chat', { message });
    return (
      data.response ||
      data.output ||
      data.message ||
      data.text ||
      "I've received your message and I'm looking into it. Please hold on a moment."
    );
  } catch {
    // Empathetic fallback — never expose internal errors
    return "I'm here to help, but I'm having a brief moment of difficulty connecting. Please try again in a few seconds.";
  }
}

/**
 * Get live metrics from watchdog (proxied through Express).
 * GET /api/metrics → Express → Watchdog port 3100
 */
export async function getMetrics(): Promise<WatchdogMetrics> {
  return request<WatchdogMetrics>('GET', '/api/metrics');
}

/**
 * Get recent server logs and active incident state (ops dashboard).
 * GET /api/logs
 */
export async function getLogs(): Promise<{
  activeIncident: { type: string | null; startedAt: string | null };
  logs: Array<Record<string, unknown>>;
}> {
  return request('GET', '/api/logs');
}

/**
 * Connect to the SSE incident stream for push-based updates.
 * Returns the EventSource — caller must call .close() on unmount.
 *
 * Usage:
 *   const es = connectIncidentStream(onUpdate, onPreAlert);
 *   return () => es.close();
 */
export function connectIncidentStream(
  onIncidentUpdate: (data: {
    type: string | null;
    status: string;
    startedAt?: string;
    resolvedAt?: string;
    previousType?: string;
  }) => void,
  onPreAlertUpdate: (data: { active: boolean; preAlert: PreAlertStatus['preAlert'] }) => void,
): EventSource {
  const es = new EventSource(`${BASE_URL}/api/incidents/stream`);

  es.addEventListener('init', (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data);
      onIncidentUpdate(data);
      if (data.preAlert !== undefined) {
        onPreAlertUpdate({ active: data.preAlert !== null, preAlert: data.preAlert });
      }
    } catch { /* ignore malformed */ }
  });

  es.addEventListener('incident-update', (e: MessageEvent) => {
    try { onIncidentUpdate(JSON.parse(e.data)); } catch { /* ignore */ }
  });

  es.addEventListener('prealert-update', (e: MessageEvent) => {
    try { onPreAlertUpdate(JSON.parse(e.data)); } catch { /* ignore */ }
  });

  // EventSource auto-reconnects on error by design
  return es;
}

/**
 * Trigger an incident manually (for testing/ops)
 * POST /simulate-failure
 */
export async function simulateFailure(type: string): Promise<void> {
  await request('POST', '/simulate-failure', { type });
}

/**
 * Trigger auto-heal manually (for testing/ops)
 * POST /auto-heal
 */
export async function autoHeal(type: string): Promise<void> {
  await request('POST', '/auto-heal', { type });
}
