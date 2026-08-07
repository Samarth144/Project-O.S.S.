/**
 * _authenticated.ops.tsx — Operations Dashboard
 *
 * Engineer-only page accessible via direct navigation to /ops.
 * Not linked in the customer navigation sidebar.
 *
 * Displays:
 *   - Live incident state (type, severity, startedAt, ragContext)
 *   - Watchdog metrics (CPU, memory, error rate, db latency, app health)
 *   - Metric history sparklines
 *   - SSE client count
 *   - Auto-refreshes every 10 seconds
 */

import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import {
  Activity,
  Cpu,
  Database,
  Wifi,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Server,
  Zap,
  Users,
  Clock,
  FileText,
  Radio,
} from "lucide-react";
import { getMetrics, getIncidentStatus, simulateFailure, autoHeal, type WatchdogMetrics, type IncidentStatus } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/ops")({
  head: () => ({
    meta: [
      { title: "Operations — Nexa Bank" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OpsPage,
});

const REFRESH_MS = 10_000;

type MetricStatus = "ok" | "warn" | "critical" | "unknown";

function statusColor(s: MetricStatus) {
  return {
    ok: "text-primary",
    warn: "text-[oklch(0.85_0.16_80)]",
    critical: "text-[oklch(0.75_0.2_25)]",
    unknown: "text-muted-foreground",
  }[s];
}

function statusBg(s: MetricStatus) {
  return {
    ok: "bg-primary/15",
    warn: "bg-[oklch(0.8_0.16_80)_/_15%]",
    critical: "bg-[oklch(0.63_0.22_25)_/_15%]",
    unknown: "bg-white/5",
  }[s];
}

function cpuStatus(v: number): MetricStatus {
  if (v >= 90) return "critical";
  if (v >= 70) return "warn";
  return "ok";
}
function memStatus(v: number): MetricStatus {
  if (v >= 90) return "critical";
  if (v >= 75) return "warn";
  return "ok";
}
function errStatus(v: number): MetricStatus {
  if (v >= 15) return "critical";
  if (v >= 5) return "warn";
  return "ok";
}
function dbStatus(v: number | null): MetricStatus {
  if (v === null) return "unknown";
  if (v >= 1500) return "critical";
  if (v >= 250) return "warn";
  return "ok";
}

function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  status,
}: {
  icon: typeof Cpu;
  label: string;
  value: string | number;
  unit: string;
  status: MetricStatus;
}) {
  return (
    <div className={`rounded-2xl ${statusBg(status)} p-5 space-y-3`}>
      <div className="flex items-center gap-2">
        <div className={`grid h-9 w-9 place-items-center rounded-xl bg-white/5 ${statusColor(status)}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className={`text-3xl font-semibold tabular-nums ${statusColor(status)}`}>
        {value}<span className="text-base font-normal ml-1 text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

function OpsPage() {
  const [metrics, setMetrics] = useState<WatchdogMetrics | null>(null);
  const [incident, setIncident] = useState<IncidentStatus | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState("payment_down");
  const [isCommandRunning, setIsCommandRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const [m, inc] = await Promise.all([getMetrics(), getIncidentStatus()]);
      setMetrics(m);
      setIncident(inc);
      setLastRefresh(new Date());
    } catch {
      /* backend might be down */
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    refresh();
    timerRef.current = setInterval(refresh, REFRESH_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleSimulate = async () => {
    setIsCommandRunning(true);
    try {
      await simulateFailure(selectedIncident);
      await refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsCommandRunning(false);
    }
  };

  const handleHeal = async () => {
    if (!incident?.incident?.type) return;
    setIsCommandRunning(true);
    try {
      await autoHeal(incident.incident.type);
      await refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsCommandRunning(false);
    }
  };

  const snap = metrics?.latest;
  const isIncidentActive = incident?.active ?? false;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Engineering</div>
          <h1 className="text-3xl font-semibold tracking-tight mt-1 flex items-center gap-2">
            Operations Dashboard
            <span className="text-xs rounded-full bg-primary/20 text-primary px-2 py-1 font-normal">Engineer Access</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live telemetry from Aegis Watchdog and Express backend.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-xl glass px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </motion.div>

      {/* Status bar */}
      <div className={`rounded-2xl px-5 py-4 flex items-center gap-4 ${isIncidentActive ? "bg-[oklch(0.63_0.22_25)_/_10%] border border-[oklch(0.63_0.22_25)_/_30%]" : "bg-primary/8 border border-primary/20"}`}>
        <div className={isIncidentActive ? "text-[oklch(0.75_0.2_25)]" : "text-primary"}>
          {isIncidentActive ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
        </div>
        <div className="flex-1">
          <span className="font-medium">
            {isIncidentActive
              ? `INCIDENT ACTIVE — ${incident?.incident?.type?.toUpperCase().replace(/_/g, " ")}`
              : "All Systems Operational"}
          </span>
          {isIncidentActive && incident?.incident?.startedAt && (
            <span className="ml-3 text-xs text-muted-foreground">
              Since {new Date(incident.incident.startedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          Last updated: {lastRefresh.toLocaleTimeString()}
        </div>
      </div>

      {/* Incident Control Panel */}
      <div className="rounded-3xl glass-strong p-6 space-y-4 border border-white/5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Zap className="h-4 w-4 text-primary" />
          Incident Control Simulator
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <select 
            value={selectedIncident}
            onChange={(e) => setSelectedIncident(e.target.value)}
            disabled={isCommandRunning || isIncidentActive}
            className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-primary/60"
          >
            <option value="payment_down">Payment Gateway Down</option>
            <option value="db_down">Database Connection Down</option>
            <option value="api_timeout">API Timeout / Degradation</option>
          </select>
          
          <button
            onClick={handleSimulate}
            disabled={isCommandRunning || isIncidentActive}
            className="rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground px-6 py-2.5 text-sm font-medium hover:brightness-110 disabled:opacity-50 disabled:grayscale transition-all"
          >
            Trigger Incident
          </button>
          
          <button
            onClick={handleHeal}
            disabled={isCommandRunning || !isIncidentActive}
            className="rounded-xl bg-green-500/20 text-green-400 border border-green-500/30 px-6 py-2.5 text-sm font-medium hover:bg-green-500/30 disabled:opacity-30 disabled:grayscale transition-all"
          >
            Auto-Heal (Resolve)
          </button>
        </div>
      </div>

      {/* Live Telemetry */}
      <div>
        <div className="text-sm font-medium mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" /> Live Metrics
          {!snap && <span className="text-xs text-muted-foreground">(backend offline or watchdog not running)</span>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={Cpu} label="CPU Usage" value={snap?.cpu ?? "—"} unit="%" status={snap ? cpuStatus(snap.cpu) : "unknown"} />
          <MetricCard icon={Server} label="Memory" value={snap?.memory ?? "—"} unit="%" status={snap ? memStatus(snap.memory) : "unknown"} />
          <MetricCard icon={Zap} label="Error Rate" value={snap?.errorRate ?? "—"} unit="/min" status={snap ? errStatus(snap.errorRate) : "unknown"} />
          <MetricCard icon={Database} label="DB Latency" value={snap?.dbLatency ?? "—"} unit="ms" status={snap ? dbStatus(snap.dbLatency) : "unknown"} />
        </div>
      </div>

      {/* App health + users */}
      {snap && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className={`rounded-2xl p-5 ${snap.appHealthy ? "bg-primary/8 border border-primary/20" : "bg-[oklch(0.63_0.22_25)_/_10%] border border-[oklch(0.63_0.22_25)_/_25%]"}`}>
            <div className="flex items-center gap-2 mb-2">
              <Wifi className={`h-4 w-4 ${snap.appHealthy ? "text-primary" : "text-[oklch(0.75_0.2_25)]"}`} />
              <span className="text-sm text-muted-foreground">App Health</span>
            </div>
            <div className={`text-xl font-semibold ${snap.appHealthy ? "text-primary" : "text-[oklch(0.75_0.2_25)]"}`}>
              {snap.appHealthy ? "HEALTHY" : "DOWN"}
            </div>
          </div>
          <div className="rounded-2xl glass-strong p-5">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Affected Users</span>
            </div>
            <div className="text-xl font-semibold">{snap.affectedUsers}</div>
          </div>
          <div className="rounded-2xl glass-strong p-5">
            <div className="flex items-center gap-2 mb-2">
              <Radio className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Metric States</span>
            </div>
            <div className="space-y-1 mt-1">
              {Object.entries(snap.states).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground capitalize">{k}</span>
                  <span className={v === "ok" ? "text-primary" : v === "warning" ? "text-[oklch(0.85_0.16_80)]" : "text-[oklch(0.75_0.2_25)]"}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active Incident Details */}
      {isIncidentActive && incident?.incident && (
        <div className="rounded-3xl glass-strong p-6 space-y-4 border border-[oklch(0.63_0.22_25)_/_25%]">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="h-4 w-4 text-[oklch(0.75_0.2_25)]" />
            Active Incident Details
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Type</div>
              <div className="font-mono mt-1">{incident.incident.type}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Severity</div>
              <div className="mt-1 capitalize">{incident.incident.severity || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Started At</div>
              <div className="mt-1">{incident.incident.startedAt ? new Date(incident.incident.startedAt).toLocaleTimeString() : "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">ETA</div>
              <div className="mt-1 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                ~{incident.incident.etaMinutes} min
              </div>
            </div>
          </div>
          {incident.incident.rootCause && (
            <div>
              <div className="text-xs text-muted-foreground mb-1.5">Root Cause (from RAG runbook)</div>
              <div className="rounded-xl glass px-4 py-3 text-sm">{incident.incident.rootCause}</div>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {metrics?.history && metrics.history.length > 0 && (
        <div className="rounded-3xl glass-strong p-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4 text-muted-foreground" /> Metric History (last {metrics.history.length} samples)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-2 pr-4">Time</th>
                  <th className="pb-2 pr-4">CPU %</th>
                  <th className="pb-2 pr-4">Mem %</th>
                  <th className="pb-2 pr-4">Err/min</th>
                  <th className="pb-2">DB ms</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[...metrics.history].reverse().slice(0, 10).map((h, i) => (
                  <tr key={i} className="font-mono">
                    <td className="py-1.5 pr-4 text-muted-foreground">{new Date(h.timestamp).toLocaleTimeString()}</td>
                    <td className={`py-1.5 pr-4 ${cpuStatus(h.cpu) === "ok" ? "" : "text-[oklch(0.85_0.16_80)]"}`}>{h.cpu}</td>
                    <td className={`py-1.5 pr-4 ${memStatus(h.memory) === "ok" ? "" : "text-[oklch(0.85_0.16_80)]"}`}>{h.memory}</td>
                    <td className={`py-1.5 pr-4 ${errStatus(h.errorRate) === "ok" ? "" : "text-[oklch(0.85_0.16_80)]"}`}>{h.errorRate}</td>
                    <td className={`py-1.5 ${dbStatus(h.dbLatency) === "ok" ? "" : "text-[oklch(0.85_0.16_80)]"}`}>{h.dbLatency ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        Auto-refreshes every {REFRESH_MS / 1000}s · Data sourced from Aegis Watchdog (port 3100) via Express proxy
      </div>
    </div>
  );
}
