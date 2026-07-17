'use strict';

const osuModule = require('node-os-utils');
const osu = osuModule.createOSUtils();
const fs   = require('fs');
const http = require('http');
const path = require('path');

// ─── Config ──────────────────────────────────────────────────────────────────
const CONFIG = {
  appBaseUrl:      process.env.APP_URL          || 'http://localhost:3000',
  observerWebhook: process.env.OBSERVER_WEBHOOK || 'http://localhost:5678/webhook/Observer',
  logPath:         process.env.LOG_PATH         || path.join(__dirname, 'project_oss.log'),
  pollMs:          Number(process.env.POLL_MS)  || 15000,   // 15s → detection lag ≤ breach*15s
  metricsPort:     Number(process.env.WATCHDOG_PORT) || 3100,
  deadLetterPath:  path.join(__dirname, 'watchdog-dead-letters.jsonl'),
  historySize:     120,                                     // 30 min at 15s polls
};

// breach = consecutive bad samples required to alert; clear = consecutive good samples to recover
const THRESHOLDS = {
  cpu:       { warn: 70,  critical: 90,   breach: 2, clear: 3, unit: '%',
               incident: { warning: 'service_degradation', critical: 'api_timeout' } },
  memory:    { warn: 75,  critical: 90,   breach: 2, clear: 3, unit: '%',
               incident: { warning: 'service_degradation', critical: 'service_degradation' } },
  errorRate: { warn: 5,   critical: 15,   breach: 1, clear: 2, unit: '/min',
               incident: { warning: 'service_degradation', critical: 'payment_down' } },
  dbLatency: { warn: 250, critical: 1500, breach: 2, clear: 3, unit: 'ms',
               incident: { warning: 'service_degradation', critical: 'db_down' } },
  appHealth: { breach: 2, clear: 2,       // 2 failed probes (~30s) = app down
               incident: { critical: 'api_timeout' } },
};

// When multiple metrics breach in the same cycle, pick the most likely root cause
const INCIDENT_PRIORITY = ['db_down', 'payment_down', 'api_timeout', 'service_degradation'];

// ─── Incremental log tail (error rate + affected users) ─────────────────────
class LogTail {
  constructor(file) {
    this.file = file;
    this.offset = 0;
    this.errors = [];                    // { t, userId } within the last 60s
    try { this.offset = fs.statSync(file).size; } catch {} // skip history on boot
  }

  poll() {
    let stat;
    try { stat = fs.statSync(this.file); } catch { return; }
    if (stat.size < this.offset) this.offset = 0;          // log rotated/truncated
    if (stat.size > this.offset) {
      const len = stat.size - this.offset;
      const buf = Buffer.alloc(len);
      let fd;
      try {
        fd = fs.openSync(this.file, 'r');
        fs.readSync(fd, buf, 0, len, this.offset);
        fs.closeSync(fd);
        this.offset = stat.size;

        for (const line of buf.toString('utf8').split('\n')) {
          if (!line.trim()) continue;
          try {
            const e = JSON.parse(line);
            if (e.level === 'error') {
              this.errors.push({
                t: new Date(e.timestamp).getTime() || Date.now(),
                userId: e.userId || null,
              });
            }
          } catch { /* non-JSON line, ignore */ }
        }
      } catch (err) {
        if (fd) {
          try { fs.closeSync(fd); } catch {}
        }
      }
    }
    const cutoff = Date.now() - 60_000;
    this.errors = this.errors.filter(e => e.t > cutoff);
  }

  ratePerMin()    { return this.errors.length; }
  affectedUsers() { return new Set(this.errors.filter(e => e.userId).map(e => e.userId)).size; }
}

// ─── Per-metric state machine with hysteresis ───────────────────────────────
// States: 'ok' | 'warning' | 'critical'. Emits events on transitions only.
class MetricMonitor {
  constructor(name, cfg) {
    this.name = name;
    this.cfg = cfg;
    this.state = 'ok';
    this.breachCount = 0;
    this.clearCount = 0;
  }

  levelFor(value) {
    if (this.cfg.critical !== undefined && value >= this.cfg.critical) return 'critical';
    if (this.cfg.warn     !== undefined && value >= this.cfg.warn)     return 'warning';
    return 'ok';
  }

  // Returns { transition: 'alert'|'recovery', severity, value } or null
  evaluate(value) {
    const level = this.levelFor(value);
    const rank = s => ({ ok: 0, warning: 1, critical: 2 }[s]);

    if (rank(level) > rank(this.state)) {
      // Getting worse — count consecutive breaches at this level or above
      this.clearCount = 0;
      this.breachCount++;
      if (this.breachCount >= this.cfg.breach) {
        this.state = level;
        this.breachCount = 0;
        return { transition: 'alert', severity: level, value };
      }
    } else if (level === 'ok' && this.state !== 'ok') {
      // Getting better — require sustained recovery
      this.breachCount = 0;
      this.clearCount++;
      if (this.clearCount >= this.cfg.clear) {
        const from = this.state;
        this.state = 'ok';
        this.clearCount = 0;
        return { transition: 'recovery', severity: from, value };
      }
    } else {
      // Steady (same level, or partial improvement like critical→warning)
      this.breachCount = 0;
      this.clearCount = 0;
    }
    return null;
  }
}

// Boolean variant for the app health probe (true = healthy)
class HealthMonitor extends MetricMonitor {
  levelFor(healthy) { return healthy ? 'ok' : 'critical'; }
}

// ─── Alert delivery: retry with backoff, dead-letter on total failure ───────
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function deliver(payload, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(CONFIG.observerWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        console.log(`[WATCHDOG] → Observer OK (${payload.alert_type}: ${payload.title})`);
        return true;
      }
      console.warn(`[WATCHDOG] Observer HTTP ${res.status}, attempt ${attempt + 1}`);
    } catch (err) {
      console.warn(`[WATCHDOG] Observer unreachable (${err.message}), attempt ${attempt + 1}`);
    }
    await sleep(1000 * 2 ** attempt);   // 1s, 2s, 4s, 8s
  }
  fs.appendFileSync(
    CONFIG.deadLetterPath,
    JSON.stringify({ ...payload, dead_lettered_at: new Date().toISOString() }) + '\n'
  );
  console.error('[WATCHDOG] Alert dead-lettered → watchdog-dead-letters.jsonl');
  return false;
}

function buildPayload({ severity, incidentType, title, metrics, correlated, affectedUsers }) {
  return {
    alert_type: severity,                       // 'warning' | 'critical' | 'recovery'
    title,
    body: title,
    source: 'aegis-watchdog',
    type: incidentType,
    tags: { ...metrics, correlated_metrics: correlated, affected_users: affectedUsers },
    timestamp: Date.now(),
    auto_detected: true,
    // Structured routing fields for n8n — never parse alert titles:
    app_reachable: monitors.appHealth.state !== 'critical',
    last_snapshot: latestSnapshot,              // last known metrics before/at alert time
  };
}

// ─── Probes ──────────────────────────────────────────────────────────────────
// GET /health on the app. Returns { healthy, dbLatencyMs } — dbLatency measured
// by the app itself (times a real SELECT 1). Timeout = unresponsive = unhealthy.
function probeHealth(timeoutMs = 3000) {
  return new Promise(resolve => {
    const req = http.get(`${CONFIG.appBaseUrl}/health`, { timeout: timeoutMs }, res => {
      let body = '';
      res.on('data', c => (body += c));
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ healthy: res.statusCode === 200 && json.ok === true,
                    dbLatencyMs: json.dbLatencyMs ?? null });
        } catch {
          resolve({ healthy: false, dbLatencyMs: null });
        }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ healthy: false, dbLatencyMs: null }); });
    req.on('error',   ()  => resolve({ healthy: false, dbLatencyMs: null }));
  });
}

// ─── Main loop ───────────────────────────────────────────────────────────────
const tail = new LogTail(CONFIG.logPath);
const monitors = {
  cpu:       new MetricMonitor('cpu',       THRESHOLDS.cpu),
  memory:    new MetricMonitor('memory',    THRESHOLDS.memory),
  errorRate: new MetricMonitor('errorRate', THRESHOLDS.errorRate),
  dbLatency: new MetricMonitor('dbLatency', THRESHOLDS.dbLatency),
  appHealth: new HealthMonitor('appHealth', THRESHOLDS.appHealth),
};

let latestSnapshot = null;
const history = [];

async function collect() {
  const [cpuRes, memRes, health] = await Promise.all([
    osu.cpu.usage(),
    osu.memory.info(),
    probeHealth(),
  ]);
  tail.poll();

  const cpuVal = cpuRes.success ? cpuRes.data : 0;
  const memVal = memRes.success ? memRes.data.usagePercentage : 0;

  const snapshot = {
    timestamp:     new Date().toISOString(),
    cpu:           +cpuVal.toFixed(1),
    memory:        +memVal.toFixed(1),
    errorRate:     tail.ratePerMin(),
    dbLatency:     health.dbLatencyMs,
    appHealthy:    health.healthy,
    affectedUsers: tail.affectedUsers(),
    states:        Object.fromEntries(Object.entries(monitors).map(([k, m]) => [k, m.state])),
  };
  latestSnapshot = snapshot;
  history.push(snapshot);
  if (history.length > CONFIG.historySize) history.shift();

  console.log(
    `[WATCHDOG] app:${health.healthy ? 'UP' : 'DOWN'} cpu:${snapshot.cpu}% ` +
    `mem:${snapshot.memory}% err:${snapshot.errorRate}/min db:${snapshot.dbLatency ?? '?'}ms`
  );

  // ── Evaluate state machines ──
  const events = [];
  const push = (name, ev, value) => ev && events.push({ metric: name, value, ...ev });

  push('appHealth', monitors.appHealth.evaluate(health.healthy), health.healthy ? 1 : 0);

  // If the app is confirmed down, an app-down alert supersedes everything else this cycle
  const appDown = monitors.appHealth.state === 'critical';
  if (!appDown) {
    push('cpu',       monitors.cpu.evaluate(snapshot.cpu),               snapshot.cpu);
    push('memory',    monitors.memory.evaluate(snapshot.memory),         snapshot.memory);
    push('errorRate', monitors.errorRate.evaluate(snapshot.errorRate),   snapshot.errorRate);
    if (health.dbLatencyMs != null)
      push('dbLatency', monitors.dbLatency.evaluate(health.dbLatencyMs), health.dbLatencyMs);
  }

  await dispatch(events, snapshot);
}

// Correlate all alert transitions from one cycle into a single root-cause payload.
// Recovery transitions are sent individually (they clear pre-alert banners).
async function dispatch(events, snapshot) {
  const alerts     = events.filter(e => e.transition === 'alert');
  const recoveries = events.filter(e => e.transition === 'recovery');

  if (alerts.length > 0) {
    const candidates = alerts.map(a => ({
      ...a,
      incidentType: a.metric === 'appHealth'
        ? THRESHOLDS.appHealth.incident.critical
        : THRESHOLDS[a.metric].incident[a.severity],
    }));
    candidates.sort((a, b) =>
      INCIDENT_PRIORITY.indexOf(a.incidentType) - INCIDENT_PRIORITY.indexOf(b.incidentType));

    const primary  = candidates[0];
    const severity = candidates.some(c => c.severity === 'critical') ? 'critical' : 'warning';
    const title = primary.metric === 'appHealth'
      ? 'CRITICAL: Application unresponsive — health probe failing'
      : `${severity.toUpperCase()}: ${primary.metric} at ${primary.value}${THRESHOLDS[primary.metric].unit}`;

    await deliver(buildPayload({
      severity,
      incidentType: primary.incidentType,
      title,
      metrics: { cpu: snapshot.cpu, memory: snapshot.memory,
                 error_rate: snapshot.errorRate, db_latency_ms: snapshot.dbLatency },
      correlated: candidates.map(c => `${c.metric}=${c.value}`),
      affectedUsers: snapshot.affectedUsers,
    }));
  }

  for (const r of recoveries) {
    await deliver(buildPayload({
      severity: 'recovery',
      incidentType: 'recovery',
      title: `RECOVERED: ${r.metric} back to normal (${r.value}${THRESHOLDS[r.metric]?.unit || ''})`,
      metrics: { metric: r.metric, value: r.value },
      correlated: [],
      affectedUsers: snapshot.affectedUsers,
    }));
  }
}

// ─── Watchdog's own metrics server (survives app death) ─────────────────────
http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url === '/metrics') {
    res.end(JSON.stringify({ latest: latestSnapshot, history, thresholds: THRESHOLDS }));
  } else {
    res.statusCode = 404;
    res.end('{}');
  }
}).listen(CONFIG.metricsPort, () =>
  console.log(`[WATCHDOG] Metrics server on :${CONFIG.metricsPort}/metrics`));

// ─── Boot ────────────────────────────────────────────────────────────────────
console.log(`[WATCHDOG] Started — polling every ${CONFIG.pollMs / 1000}s, watching ${CONFIG.appBaseUrl}`);
collect();
setInterval(collect, CONFIG.pollMs);
