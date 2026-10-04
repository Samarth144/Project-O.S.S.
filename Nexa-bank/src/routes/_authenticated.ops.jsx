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
const TRAINING_MESSAGES = [
    "Preparing the isolated recovery simulation…",
    "Running the selected failure scenario across episodes…",
    "Comparing recovery strategies and verification outcomes…",
    "Updating the remediation policy metrics…",
];
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
    const [policyTask, setPolicyTask] = useState(null);
    const [trainingMessageIndex, setTrainingMessageIndex] = useState(0);
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
    useEffect(() => { setPolicyCurve(policyData?.trainingCurves?.[policyType] ?? []); }, [policyData, policyType]);
    useEffect(() => {
        if (policyTask !== "train") return;
        const interval = setInterval(() => setTrainingMessageIndex((index) => (index + 1) % TRAINING_MESSAGES.length), 3000);
        return () => clearInterval(interval);
    }, [policyTask]);
    const handleTrainPolicy = async () => {
        const startedAt = Date.now();
        setPolicyBusy(true);
        setPolicyTask("train");
        setTrainingMessageIndex(0);
        setPolicyMessage("");
        try {
            const result = await trainPolicy(policyType, episodes);
            setPolicyCurve(result.curve || []);
            setPolicyData(await getPolicy());
            setPolicyMessage(`Training complete · ${result.curve?.length ?? episodes} episodes simulated.`);
        } catch (err) { setPolicyMessage(`Training failed: ${err?.message || "Please try again."}`); }
        finally {
            const remaining = Math.max(0, 15000 - (Date.now() - startedAt));
            if (remaining) await new Promise((resolve) => setTimeout(resolve, remaining));
            setPolicyBusy(false);
            setPolicyTask(null);
        }
    };
    const handleResetPolicy = async () => {
        setPolicyBusy(true);
        setPolicyTask("reset");
        try {
            const result = await resetPolicy();
            setPolicyData({ stats: result.stats, lastDecision: null });
            setPolicyCurve([]);
            setPolicyMessage("Policy statistics reset.");
        } catch (err) { setPolicyMessage(err?.message || "Reset failed."); }
        finally { setPolicyBusy(false); setPolicyTask(null); }
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

      <section className="overflow-hidden rounded-[26px] border border-[#b8f36b]/15 bg-gradient-to-br from-[#141b20] via-[#11171d] to-[#0e1419] shadow-[0_24px_80px_-55px_rgba(184,243,107,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex items-start gap-3.5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#b8f36b]/15 bg-[#b8f36b]/[0.08] text-[#b8f36b]"><BrainCircuit className="h-5 w-5"/></div>
            <div>
            <h2 className="text-base font-semibold tracking-tight text-white/90">Self-Learning Remediation</h2>
            <p className="mt-1 text-xs text-white/45">Train recovery strategies against isolated incident simulations.</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#b8f36b]/15 bg-[#b8f36b]/[0.06] px-3 py-1.5 text-[10px] font-medium tracking-wide text-[#c4f889]"><span className="h-1.5 w-1.5 rounded-full bg-[#b8f36b]"/> SIMULATED ENVIRONMENT</span>
        </div>
        <div className="grid gap-5 px-5 py-5 sm:px-7 sm:py-6 xl:grid-cols-[minmax(0,1fr)_minmax(180px,0.32fr)] xl:items-end">
        <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_140px_auto_auto] sm:items-end">
          <label className="grid gap-2 text-xs font-medium text-white/50">Failure type
            <select value={policyType} onChange={e => setPolicyType(e.target.value)} disabled={policyBusy} className="h-11 w-full rounded-xl border border-white/[0.09] bg-[#0b0f14] px-3 text-sm text-white/85 outline-none transition focus:border-[#b8f36b]/40 disabled:opacity-50">
              <option value="db_down">Database down</option><option value="payment_down">Payment down</option><option value="api_timeout">API timeout</option><option value="high_error_rate">High error rate</option>
            </select>
          </label>
          <label className="grid gap-2 text-xs font-medium text-white/50">Episodes
            <input type="number" min="1" max="500" value={episodes} disabled={policyBusy} onChange={e => setEpisodes(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} className="h-11 w-full rounded-xl border border-white/[0.09] bg-[#0b0f14] px-3 text-sm text-white/85 outline-none transition focus:border-[#b8f36b]/40 disabled:opacity-50" />
          </label>
          <button onClick={handleTrainPolicy} disabled={policyBusy} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#b8f36b] px-5 text-sm font-semibold text-[#14200d] transition hover:bg-[#c9ff83] disabled:cursor-wait disabled:opacity-50">{policyTask === "train" && <RefreshCw className="h-4 w-4 animate-spin"/>}{policyTask === "train" ? "Training…" : "Train policy"}</button>
          <button onClick={handleResetPolicy} disabled={policyBusy} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-sm text-white/60 transition hover:border-white/20 hover:text-white/85 disabled:opacity-50"><RotateCcw className="h-4 w-4"/>Reset</button>
        </div>
        <div className="grid gap-3">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3"><div className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/35">Recorded attempts</div><div className="mt-1 text-lg font-semibold tabular-nums text-[#c4f889]">{policyData?.stats?.[policyType]?.totalPulls ?? 0}</div></div>
        </div>
        </div>
        {policyTask === "train" ? (
          <div className="mx-5 mb-5 rounded-2xl border border-[#b8f36b]/15 bg-[#b8f36b]/[0.035] p-4 sm:mx-7" role="status" aria-live="polite">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#b8f36b]/[0.08] text-[#b8f36b]"><RefreshCw className="h-4 w-4 animate-spin"/></div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-white/85">Training remediation policy</div>
                <div className="mt-1 text-xs text-white/50">{TRAINING_MESSAGES[trainingMessageIndex]}</div>
              </div>
              <span className="hidden shrink-0 text-xs tabular-nums text-white/40 sm:inline">{episodes} episodes</span>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><motion.div className="h-full w-1/3 rounded-full bg-[#b8f36b]" animate={{ x: ["-100%", "300%"] }} transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}/></div>
            <p className="mt-2 text-[11px] text-white/35">Training takes at least 15 seconds. Live services are not affected.</p>
          </div>
        ) : policyMessage && <div className={`mx-5 mb-5 rounded-xl border px-4 py-3 text-xs sm:mx-7 ${policyMessage.startsWith("Training failed") ? "border-rose-400/20 bg-rose-400/[0.04] text-rose-200" : "border-[#b8f36b]/15 bg-[#b8f36b]/[0.035] text-[#c4f889]"}`} role="status">{policyMessage}</div>}
        <div className="relative px-5 pb-5 sm:px-7 sm:pb-6">
        <div className={`grid gap-4 transition-all duration-500 xl:grid-cols-2 ${policyTask === "train" ? "pointer-events-none select-none blur-[5px] opacity-35" : "blur-0 opacity-100"}`} aria-hidden={policyTask === "train"}>
          <div className="min-w-0 rounded-2xl border border-white/[0.07] bg-[#0b0f14]/55 p-4 sm:p-5">
            <div className="mb-1 text-sm font-medium text-white/80">Attempts per episode</div><div className="mb-3 text-[11px] text-white/35">Fewer attempts indicate a faster recovery.</div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%"><LineChart data={policyCurve} margin={{ top: 8, right: 12, bottom: 2, left: -16 }}><CartesianGrid strokeDasharray="3 5" stroke="#ffffff12"/><XAxis type="number" dataKey="episode" domain={[1, "dataMax"]} tickCount={6} tick={{ fontSize: 10, fill: "#7e8a91" }} axisLine={{ stroke: "#ffffff18" }} tickLine={false}/><YAxis domain={[0, 3]} allowDecimals={false} tick={{ fontSize: 10, fill: "#7e8a91" }} axisLine={false} tickLine={false}/><Tooltip contentStyle={{ background: "#11171d", border: "1px solid #ffffff1a", borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "#c4f889" }}/><Line type="monotone" dataKey="attempts" name="Attempts" stroke="#b8f36b" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "#b8f36b", stroke: "#0b0f14", strokeWidth: 2 }}/></LineChart></ResponsiveContainer>
            </div>
          </div>
          <div className="min-w-0 rounded-2xl border border-white/[0.07] bg-[#0b0f14]/55 p-4 sm:p-5">
            <div className="mb-1 text-sm font-medium text-white/80">Success rate by recovery action</div><div className="mb-3 text-[11px] text-white/35">Hover a bar to see its attempt count.</div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%"><BarChart data={Object.entries(policyData?.stats?.[policyType]?.actions || {}).map(([action, stats]) => ({ action, rate: Math.round(stats.successRate * 100), pulls: stats.pulls }))} margin={{ top: 8, right: 10, bottom: 8, left: -16 }}><CartesianGrid vertical={false} strokeDasharray="3 5" stroke="#ffffff12"/><XAxis dataKey="action" tick={{ fontSize: 9, fill: "#7e8a91" }} interval={0} angle={-18} textAnchor="end" height={55} axisLine={{ stroke: "#ffffff18" }} tickLine={false}/><YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#7e8a91" }} axisLine={false} tickLine={false}/><Tooltip cursor={false} contentStyle={{ background: "#11171d", border: "1px solid #ffffff1a", borderRadius: 12, fontSize: 12 }} formatter={(value, name, item) => name === "rate" ? [`${value}% · ${item.payload.pulls} attempts`, "Success"] : [value, name]}/><Bar dataKey="rate" name="Success rate" fill="#52c7c1" radius={[5, 5, 0, 0]} maxBarSize={42}/></BarChart></ResponsiveContainer>
            </div>
          </div>
        </div>
        {policyTask === "train" && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-10 grid place-items-center" aria-live="polite">
          <div className="flex items-center gap-3 rounded-2xl border border-[#b8f36b]/20 bg-[#11171d]/95 px-5 py-4 shadow-2xl backdrop-blur-xl">
            <RefreshCw className="h-4 w-4 animate-spin text-[#b8f36b]"/>
            <div><div className="text-sm font-medium text-white/85">Updating charts</div><div className="mt-0.5 text-xs text-white/45">Results appear when training completes.</div></div>
          </div>
        </motion.div>}
        </div>
        <div className="mx-5 mb-5 flex flex-wrap items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 sm:mx-7 sm:mb-7 sm:px-5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#b8f36b]/[0.08] text-[#b8f36b]"><CheckCircle2 className="h-5 w-5"/></div>
          <div className="min-w-0 flex-1"><div className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/35">Last policy decision</div>
          {policyData?.lastDecision ? <div className="mt-1"><span className="font-mono text-sm font-semibold text-[#c4f889]">{policyData.lastDecision.decision}</span><span className="ml-2 text-xs text-white/45">{policyData.lastDecision.reason}</span><div className="mt-1 truncate text-xs text-white/35">{policyData.lastDecision.evidence}</div></div> : <div className="mt-1 text-xs text-white/40">No policy decision recorded yet.</div>}</div>
          {policyData?.lastDecision && <div className="shrink-0 rounded-xl border border-[#b8f36b]/15 bg-[#b8f36b]/[0.05] px-3.5 py-2"><div className="text-[10px] text-white/35">Confidence</div><div className="mt-0.5 text-sm font-semibold tabular-nums text-[#c4f889]">{(policyData.lastDecision.confidence * 100).toFixed(0)}%</div></div>}
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
