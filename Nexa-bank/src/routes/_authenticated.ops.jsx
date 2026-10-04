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
import { Activity, Cpu, Database, Wifi, AlertTriangle, CheckCircle2, RefreshCw, Server, Zap, Users, Clock, FileText, Radio, BrainCircuit, RotateCcw, } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { getMetrics, resolveIncident, transferMoney, getPolicy, trainPolicy, resetPolicy } from "@/lib/api";
import { useIncidentBus } from "@/hooks/useIncidentBus";
export const Route = createFileRoute("/_authenticated/ops")({
    head: () => ({
        meta: [
            { title: "Operations — Nexa Bank" },
            { name: "robots", content: "noindex" },
        ],
    }),
    component: OpsPage,
});
const REFRESH_MS = 8000;
function cpuStatus(v) {
    if (v >= 90)
        return "critical";
    if (v >= 70)
        return "warning";
    return "ok";
}
function memStatus(v) {
    if (v >= 90)
        return "critical";
    if (v >= 75)
        return "warning";
    return "ok";
}
function errStatus(v) {
    if (v >= 15)
        return "critical";
    if (v >= 5)
        return "warning";
    return "ok";
}
function dbStatus(v) {
    if (v === null || v >= 1500)
        return "critical";
    if (v >= 250)
        return "warning";
    return "ok";
}
function statusColor(status) {
    switch (status) {
        case "critical":
            return "text-rose-300";
        case "warning":
            return "text-amber-300";
        case "ok":
            return "text-[#b8f36b]";
        default:
            return "text-muted-foreground";
    }
}
function statusBg(status) {
    switch (status) {
        case "critical":
            return "border-rose-400/20 bg-rose-400/[0.06]";
        case "warning":
            return "border-amber-300/20 bg-amber-300/[0.05]";
        case "ok":
            return "border-[#b8f36b]/15 bg-[#b8f36b]/[0.035]";
        default:
            return "border-white/10 bg-white/5";
    }
}
function MetricCard({ icon: Icon, label, value, unit, status, }) {
    return (<div className={`rounded-[22px] border p-5 transition-all ${statusBg(status)}`}>
      <div className="mb-5 flex items-center justify-between">
        <span className="text-xs font-medium text-white/50">{label}</span>
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-black/15"><Icon className={`h-4 w-4 ${statusColor(status)}`}/></div>
      </div>
      <div className={`text-3xl font-semibold tracking-tight tabular-nums ${statusColor(status)}`}>
        {value}<span className="ml-1 text-sm font-normal text-white/35">{unit}</span>
      </div>
    </div>);
}
function OpsPage() {
    const { incident, triggerIncident, healIncident, refresh: refreshBus } = useIncidentBus();
    const [metrics, setMetrics] = useState(null);
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const [refreshing, setRefreshing] = useState(false);
    const [selectedIncident, setSelectedIncident] = useState("payment_down");
    const [actionRunning, setActionRunning] = useState(null);
    const [escalated, setEscalated] = useState(false);
    const [escalationReason, setEscalationReason] = useState("");
    const [policyType, setPolicyType] = useState("db_down");
    const [episodes, setEpisodes] = useState(50);
    const [policyData, setPolicyData] = useState(null);
    const [policyCurve, setPolicyCurve] = useState([]);
    const [policyBusy, setPolicyBusy] = useState(false);
    const [policyMessage, setPolicyMessage] = useState("");
    const timerRef = useRef(null);
    const isIncidentActive = incident !== null;
    const refreshMetrics = async () => {
        setRefreshing(true);
        try {
            const m = await getMetrics();
            setMetrics(m);
            refreshBus();
        }
        catch {
            /* metrics offline */
        }
        finally {
            setLastRefresh(new Date());
            setRefreshing(false);
        }
    };
    useEffect(() => {
        refreshMetrics();
        const interval = isIncidentActive ? 2000 : 5000;
        timerRef.current = setInterval(refreshMetrics, interval);
        return () => {
            if (timerRef.current)
                clearInterval(timerRef.current);
        };
    }, [isIncidentActive]);
    useEffect(() => { getPolicy().then(setPolicyData).catch(() => {}); }, []);
    const handleTrainPolicy = async () => {
        setPolicyBusy(true);
        setPolicyMessage("");
        try {
            const result = await trainPolicy(policyType, episodes);
            setPolicyCurve(result.curve || []);
            setPolicyData(await getPolicy());
            setPolicyMessage("Training complete in simulated environment.");
        } catch (err) { setPolicyMessage(err?.message || "Training failed."); }
        finally { setPolicyBusy(false); }
    };
    const handleResetPolicy = async () => {
        setPolicyBusy(true);
        try {
            const result = await resetPolicy();
            setPolicyData({ stats: result.stats, lastDecision: null });
            setPolicyCurve([]);
            setPolicyMessage("Policy statistics reset.");
        } catch (err) { setPolicyMessage(err?.message || "Reset failed."); }
        finally { setPolicyBusy(false); }
    };
    const handleSimulate = async () => {
        if (actionRunning || isIncidentActive)
            return;
        setActionRunning("simulate");
        setEscalated(false);
        setEscalationReason("");
        try {
            await triggerIncident(selectedIncident);
        }
        catch (err) {
            console.error("Failed to simulate incident:", err);
        }
        finally {
            setActionRunning(null);
            setLastRefresh(new Date());
        }
    };
    const handleHeal = async () => {
        if (actionRunning || !isIncidentActive)
            return;
        const currentType = incident?.type || selectedIncident;
        setActionRunning("heal");
        try {
            await healIncident(currentType);
            setEscalated(false);
            setEscalationReason("");
        }
        catch (err) {
            console.error("Auto-heal response:", err);
            setEscalated(true);
            setEscalationReason(err?.body?.reason || err?.message || "Max heal attempts exceeded. Manual intervention required.");
        }
        finally {
            setActionRunning(null);
            setLastRefresh(new Date());
        }
    };
    const handleForceResolve = async () => {
        if (actionRunning)
            return;
        setActionRunning("force");
        try {
            await resolveIncident();
            setEscalated(false);
            setEscalationReason("");
        }
        catch (err) {
            console.error("Manual force resolve failed:", err);
        }
        finally {
            setActionRunning(null);
            setLastRefresh(new Date());
        }
    };

    const handleSimulateUser = async () => {
        if (actionRunning || !isIncidentActive)
            return;
        setActionRunning("simUser");
        try {
            const demoUsers = [
                "pranavjadhav1319@gmail.com",
                "aarav.sharma@nexabank.com",
                "priya.patel@example.com",
                "vikram.malhotra@corp.in",
                "ananya.verma@techbank.in",
                "rohan.mehta@startup.co",
                "neha.sharma@cloudfin.io"
            ];
            const currentCount = incident?.affectedUserCount || 0;
            const nextEmail = demoUsers[currentCount % demoUsers.length] || `customer_${Date.now().toString().slice(-4)}@example.com`;
            await transferMoney({
                amount: 2500,
                fromAccount: "savings",
                toAccount: "ACC-99381042",
                remarks: "Simulated transfer attempt",
                method: "IMPS",
                userEmail: nextEmail,
            });
        }
        catch (_) {
            // Expected 503 during active incident — backend increments affectedUserCount and broadcasts SSE
        }
        finally {
            setActionRunning(null);
            setLastRefresh(new Date());
        }
    };
    const snap = metrics?.latest;
    return (<div className="min-h-screen w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <div className="mx-auto w-full max-w-[1600px] space-y-7">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-medium tracking-[0.18em] text-[#b8f36b]"><Activity className="h-3.5 w-3.5"/> ENGINEERING / OBSERVABILITY</div>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 text-3xl font-medium tracking-[-0.05em] sm:text-4xl">
            Operations Dashboard
            <span className="rounded-full border border-[#b8f36b]/20 bg-[#b8f36b]/[0.06] px-2.5 py-1 text-[10px] font-medium tracking-wide text-[#c4f889]">ENGINEER ACCESS</span>
          </h1>
          <p className="mt-2 text-sm text-white/45">
            Live telemetry from Aegis Watchdog and Express backend.
          </p>
        </div>
        <button onClick={refreshMetrics} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 py-2.5 text-sm text-white/70 transition hover:border-[#b8f36b]/25 hover:text-[#c4f889] disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin text-[#b8f36b]" : ""}`}/>
          Refresh
        </button>
      </motion.div>

      {/* Status bar */}
      <div className={`flex flex-wrap items-center gap-4 rounded-[22px] px-5 py-4 transition-all ${isIncidentActive ? "border border-rose-400/20 bg-rose-400/[0.06]" : "border border-[#b8f36b]/15 bg-[#b8f36b]/[0.035]"}`}>
        <div className={isIncidentActive ? "text-rose-300" : "text-[#b8f36b]"}>
          {isIncidentActive ? <AlertTriangle className="h-5 w-5 animate-pulse"/> : <CheckCircle2 className="h-5 w-5"/>}
        </div>
        <div className="flex-1">
          <span className={`font-semibold tracking-wide ${isIncidentActive ? "text-rose-200" : "text-[#c4f889]"}`}>
            {isIncidentActive
            ? `INCIDENT ACTIVE — ${incident?.type?.toUpperCase().replace(/_/g, " ")}`
            : "All Systems Operational"}
          </span>
          {isIncidentActive && incident?.startedAt && (<span className="ml-3 text-xs text-muted-foreground">
              Since {new Date(incident.startedAt).toLocaleTimeString()}
            </span>)}
        </div>
        <div className="ml-auto text-xs text-white/40">
          Last updated · {lastRefresh.toLocaleTimeString()}
        </div>
      </div>

      {/* Incident Control Panel */}
      <div className="space-y-5 rounded-[24px] border border-white/[0.08] bg-[#11171d]/90 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm font-semibold text-white/90">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#b8f36b]/[0.08] text-[#b8f36b]"><Zap className="h-4 w-4"/></div>
            Incident Control Simulator
          </div>
          {isIncidentActive ? (<span className="text-xs text-amber-300 font-medium animate-pulse">
              ⚠️ Incident active. Click Auto-Heal to trigger autonomous remediation.
            </span>) : (<span className="text-xs text-emerald-400 font-medium">
              ✓ Ready for failure testing
            </span>)}
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <select value={selectedIncident} onChange={(e) => setSelectedIncident(e.target.value)} disabled={actionRunning !== null || isIncidentActive} className="min-w-0 flex-1 rounded-xl border border-white/[0.09] bg-[#0b0f14] px-4 py-2.5 text-sm text-white/75 outline-none focus:border-[#b8f36b]/40 disabled:opacity-50">
            <option value="payment_down" className="bg-slate-900 text-white">Payment Gateway Down (payment_down)</option>
            <option value="db_down" className="bg-slate-900 text-white">Database Connection Down (db_down)</option>
            <option value="api_timeout" className="bg-slate-900 text-white">API Timeout / Degradation (api_timeout)</option>
          </select>
          
          <button onClick={handleSimulate} disabled={actionRunning !== null || isIncidentActive} className="flex min-h-11 min-w-[150px] items-center justify-center gap-2 rounded-xl bg-[#b8f36b] px-5 py-2.5 text-sm font-semibold text-[#14200d] transition hover:bg-[#c9ff83] disabled:cursor-not-allowed disabled:opacity-40">
            {actionRunning === "simulate" && <RefreshCw className="h-4 w-4 animate-spin"/>}
            {actionRunning === "simulate" ? "Triggering..." : "Trigger Incident"}
          </button>
          
          <button onClick={handleHeal} disabled={actionRunning !== null || !isIncidentActive} className="flex min-h-11 min-w-[170px] items-center justify-center gap-2 rounded-xl border border-[#b8f36b]/20 bg-[#b8f36b]/[0.08] px-5 py-2.5 text-sm font-medium text-[#c4f889] transition hover:bg-[#b8f36b]/[0.13] disabled:cursor-not-allowed disabled:opacity-30">
            {actionRunning === "heal" && <RefreshCw className="h-4 w-4 animate-spin"/>}
            {actionRunning === "heal" ? "Healing..." : "Auto-Heal (Resolve)"}
          </button>

          <button
            onClick={handleSimulateUser}
            disabled={actionRunning !== null || !isIncidentActive}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/[0.04] px-4 py-2.5 text-sm font-medium text-amber-200 transition hover:bg-amber-300/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
            title="Simulate another customer attempting a transfer during this incident"
          >
            {actionRunning === "simUser" ? <RefreshCw className="h-4 w-4 animate-spin text-amber-400" /> : <Users className="h-4 w-4 text-amber-400" />}
            +1 Blocked Customer
          </button>
        </div>

        {escalated && (
          <div className="mt-4 p-3.5 rounded-xl border border-red-500/40 bg-red-500/10 text-red-200 text-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
              <span>Auto-heal escalated to engineer: <strong className="font-semibold text-white">{escalationReason}</strong></span>
            </div>
            <button
              onClick={handleForceResolve}
              disabled={actionRunning === "force"}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-xs transition flex items-center gap-1.5 shadow"
            >
              {actionRunning === "force" && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              {actionRunning === "force" ? "Resolving..." : "Force Manual Resolve"}
            </button>
          </div>
        )}
      </div>

      <section className="rounded-3xl glass-strong p-6 space-y-5 border border-primary/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold"><BrainCircuit className="h-4 w-4 text-primary"/>Self-Learning Remediation</div>
            <p className="mt-1 text-xs text-muted-foreground">Training runs only in a simulated environment.</p>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">simulated environment</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs text-muted-foreground">Failure type
            <select value={policyType} onChange={e => setPolicyType(e.target.value)} disabled={policyBusy} className="rounded-xl bg-slate-900/90 border border-white/10 px-3 py-2 text-sm text-foreground">
              <option value="db_down">Database down</option><option value="payment_down">Payment down</option><option value="api_timeout">API timeout</option><option value="high_error_rate">High error rate</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">Episodes
            <input type="number" min="1" max="500" value={episodes} onChange={e => setEpisodes(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} className="w-28 rounded-xl bg-slate-900/90 border border-white/10 px-3 py-2 text-sm text-foreground" />
          </label>
          <button onClick={handleTrainPolicy} disabled={policyBusy} className="rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{policyBusy ? "Training..." : "Train"}</button>
          <button onClick={handleResetPolicy} disabled={policyBusy} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm disabled:opacity-50"><RotateCcw className="h-4 w-4"/>Reset</button>
          {policyMessage && <span className="text-xs text-muted-foreground">{policyMessage}</span>}
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/5 p-4">
            <div className="mb-3 text-xs font-medium text-muted-foreground">Attempts per episode</div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%"><LineChart data={policyCurve}><CartesianGrid strokeDasharray="3 3" stroke="#ffffff18"/><XAxis dataKey="episode" tick={{ fontSize: 10 }}/><YAxis domain={[0, 3]} allowDecimals={false} tick={{ fontSize: 10 }}/><Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }}/><Line type="monotone" dataKey="attempts" stroke="#60a5fa" dot={false}/></LineChart></ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-2xl border border-white/5 p-4">
            <div className="mb-3 text-xs font-medium text-muted-foreground">Success rate per fix (pull count)</div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%"><BarChart data={Object.entries(policyData?.stats?.[policyType]?.actions || {}).map(([action, stats]) => ({ action, rate: Math.round(stats.successRate * 100), pulls: stats.pulls }))}><CartesianGrid strokeDasharray="3 3" stroke="#ffffff18"/><XAxis dataKey="action" tick={{ fontSize: 9 }} interval={0} angle={-15} textAnchor="end" height={50}/><YAxis domain={[0, 100]} tick={{ fontSize: 10 }}/><Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} formatter={(value, name, item) => name === "rate" ? [`${value}% · ${item.payload.pulls} pulls`, "Success"] : [value, name]}/><Bar dataKey="rate" fill="#34d399" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-sm">
          <div className="mb-1 text-xs text-muted-foreground">Last decision</div>
          {policyData?.lastDecision ? <div><span className="font-mono text-primary">{policyData.lastDecision.decision}</span><span className="ml-2 text-xs text-muted-foreground">{policyData.lastDecision.reason} · confidence {(policyData.lastDecision.confidence * 100).toFixed(0)}%</span><div className="mt-1 text-xs text-muted-foreground">{policyData.lastDecision.evidence}</div></div> : <span className="text-xs text-muted-foreground">No policy decision recorded yet.</span>}
        </div>
      </section>

      {/* Live Telemetry */}
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm font-medium text-white/85">
          <Activity className="h-4 w-4 text-[#b8f36b]"/> Live Metrics
          {!snap && <span className="text-xs text-white/35">(backend offline or watchdog not running)</span>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Cpu} label="CPU Usage" value={snap?.cpu ?? "—"} unit="%" status={snap ? cpuStatus(snap.cpu) : "unknown"}/>
          <MetricCard icon={Server} label="Memory" value={snap?.memory ?? "—"} unit="%" status={snap ? memStatus(snap.memory) : "unknown"}/>
          <MetricCard icon={Zap} label="Error Rate" value={snap?.errorRate ?? "—"} unit="/min" status={snap ? errStatus(snap.errorRate) : "unknown"}/>
          <MetricCard icon={Database} label="DB Latency" value={snap?.dbLatency ?? "—"} unit="ms" status={snap ? dbStatus(snap.dbLatency) : "unknown"}/>
        </div>
      </div>

      {/* App health + users */}
      {snap && (<div className="grid gap-4 sm:grid-cols-3">
          <div className={`rounded-[22px] p-5 ${snap.appHealthy ? "border border-[#b8f36b]/15 bg-[#b8f36b]/[0.035]" : "border border-rose-400/20 bg-rose-400/[0.06]"}`}>
            <div className="flex items-center gap-2 mb-2">
              <Wifi className={`h-4 w-4 ${snap.appHealthy ? "text-[#b8f36b]" : "text-rose-300"}`}/>
              <span className="text-sm text-white/50">App Health</span>
            </div>
            <div className={`text-xl font-semibold ${snap.appHealthy ? "text-[#c4f889]" : "text-rose-300"}`}>
              {snap.appHealthy ? "HEALTHY" : "DOWN"}
            </div>
          </div>
          <div className="rounded-[22px] border border-white/[0.08] bg-[#11171d]/90 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-white/45"/>
              <span className="text-sm text-white/50">Affected Users</span>
            </div>
            <div className="text-xl font-semibold">
              {incident?.affectedUserCount ?? snap?.affectedUsers ?? 0}
            </div>
          </div>
          <div className="rounded-[22px] border border-white/[0.08] bg-[#11171d]/90 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Radio className="h-4 w-4 text-white/45"/>
              <span className="text-sm text-white/50">Metric States</span>
            </div>
            <div className="space-y-1 mt-1">
              {Object.entries(snap.states).map(([k, v]) => (<div key={k} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground capitalize">{k}</span>
                  <span className={v === "ok" ? "text-primary" : v === "warning" ? "text-[oklch(0.85_0.16_80)]" : "text-[oklch(0.75_0.2_25)]"}>{v}</span>
                </div>))}
            </div>
          </div>
        </div>)}

      {/* Active Incident Details */}
      {isIncidentActive && incident?.incident && (<div className="space-y-4 rounded-[24px] border border-rose-400/20 bg-rose-400/[0.035] p-5 sm:p-6">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="h-4 w-4 text-[oklch(0.75_0.2_25)]"/>
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
                <Clock className="h-3.5 w-3.5"/>
                ~{incident.incident.etaMinutes} min
              </div>
            </div>
          </div>
          {incident.incident.rootCause && (<div>
              <div className="text-xs text-muted-foreground mb-1.5">Root Cause (from RAG runbook)</div>
              <div className="rounded-xl glass px-4 py-3 text-sm">{incident.incident.rootCause}</div>
            </div>)}
        </div>)}

      {/* History */}
      {metrics?.history && metrics.history.length > 0 && (<div className="space-y-4 rounded-[24px] border border-white/[0.08] bg-[#11171d]/90 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3 text-sm font-medium text-white/85">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.04] text-white/50"><FileText className="h-4 w-4"/></div> Metric History
          </div><span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] text-white/40">Last {metrics.history.length} samples</span></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] text-xs">
              <thead>
                <tr className="border-b border-white/[0.07] text-left text-white/40">
                  <th className="pb-3 pr-4 font-medium">Time</th>
                  <th className="pb-3 pr-4 font-medium">CPU %</th>
                  <th className="pb-3 pr-4 font-medium">Mem %</th>
                  <th className="pb-3 pr-4 font-medium">Err/min</th>
                  <th className="pb-3 font-medium">DB ms</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {[...metrics.history].reverse().slice(0, 10).map((h, i) => (<tr key={i} className="font-mono text-white/70">
                    <td className="py-3 pr-4 text-white/40">{new Date(h.timestamp).toLocaleTimeString()}</td>
                    <td className={`py-3 pr-4 ${statusColor(cpuStatus(h.cpu))}`}>{h.cpu}</td>
                    <td className={`py-3 pr-4 ${statusColor(memStatus(h.memory))}`}>{h.memory}</td>
                    <td className={`py-3 pr-4 ${statusColor(errStatus(h.errorRate))}`}>{h.errorRate}</td>
                    <td className={`py-3 ${statusColor(dbStatus(h.dbLatency))}`}>{h.dbLatency ?? "—"}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        </div>)}

      <div className="border-t border-white/[0.06] pt-4 text-xs text-white/35">
        Auto-refreshes every {REFRESH_MS / 1000}s · Data sourced from Aegis Watchdog (port 3100) via Express proxy
      </div>
      </div>
    </div>);
}
