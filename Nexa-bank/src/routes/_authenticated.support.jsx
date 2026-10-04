import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Shield, Send, ShieldCheck, AlertTriangle, CheckCircle2, Activity, HelpCircle, Cpu, Lock, } from "lucide-react";
import { sendChatMessage } from "@/lib/api";
import { useIncidentBus } from "@/hooks/useIncidentBus";
import { user } from "@/lib/mock-data";
export const Route = createFileRoute("/_authenticated/support")({
    head: () => ({ meta: [{ title: "Shield Support — Nexa Bank" }] }),
    component: ShieldSupportPage,
});
const quickQuestions = [
    "What is currently broken?",
    "Will my payment go through right now?",
    "How long until this is fixed?",
    "Is my money and data safe?",
    "Why did my transaction fail?",
    "How do I block or unfreeze my card?",
];
function formatTime(d = new Date()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function ShieldSupportPage() {
    const { incident, preAlert, justResolved, backendOffline } = useIncidentBus();
    const [messages, setMessages] = useState([
        {
            id: "m0",
            role: "shield",
            text: "Hi! I'm Shield. I have live access to our engineering systems, telemetry, and runbooks, so I can give you specific, real-time answers — not generic updates. What's going on for you?",
            timestamp: formatTime(),
        },
    ]);
    const [input, setInput] = useState("");
    const [typing, setTyping] = useState(false);
    const scrollRef = useRef(null);
    const inputRef = useRef(null);
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [messages, typing]);
    const send = async (text) => {
        const clean = text.trim();
        if (!clean || typing)
            return;
        const userMsg = {
            id: `u${Date.now()}`,
            role: "user",
            text: clean,
            timestamp: formatTime(),
        };
        setMessages((m) => [...m, userMsg]);
        setInput("");
        setTyping(true);
        try {
            // Express enriches this with dynamic RAG runbook context, then forwards to n8n Shield agent
            const reply = await sendChatMessage(clean);
            setMessages((m) => [
                ...m,
                {
                    id: `s${Date.now()}`,
                    role: "shield",
                    text: reply,
                    timestamp: formatTime(),
                },
            ]);
        }
        catch {
            setMessages((m) => [
                ...m,
                {
                    id: `s${Date.now()}`,
                    role: "shield",
                    text: "Could not reach the Project O.S.S. backend service. Please verify the server is running on port 3000.",
                    timestamp: formatTime(),
                },
            ]);
        }
        finally {
            setTyping(false);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    };
    const handleQuickQuestion = (q) => {
        send(q);
    };
    return (<div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Incident Intelligence & Support</div>
          <h1 className="text-3xl font-semibold tracking-tight mt-1 flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]">
              <Shield className="h-5 w-5"/>
            </span>
            Shield Assistant
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Powered by Project O.S.S. · Real-time telemetry, historical runbooks & autonomous intelligence.
          </p>
        </div>

        {/* Live System Status Pill */}
        <div className="flex items-center gap-2">
          {backendOffline ? (<div className="inline-flex items-center gap-2 rounded-full bg-red-500/15 border border-red-500/30 px-3.5 py-1.5 text-xs font-medium text-red-400">
              <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse"/>
              Backend Offline
            </div>) : incident ? (<div className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 border border-amber-500/30 px-3.5 py-1.5 text-xs font-medium text-amber-300">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping"/>
              Incident Active: {incident.type.replace(/_/g, " ").toUpperCase()}
              {incident.etaMinutes && (<span className="rounded bg-amber-500/30 px-1.5 py-0.5 text-[10px] text-amber-200">
                  ETA ~{incident.etaMinutes}m
                </span>)}
            </div>) : (<div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3.5 py-1.5 text-xs font-medium text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400"/>
              All Systems Operational
            </div>)}
        </div>
      </motion.div>

      {/* Pre-Alert Banner if active */}
      <AnimatePresence>
        {preAlert && (<motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="rounded-2xl bg-amber-500/15 border border-amber-500/30 p-3.5 flex items-center gap-3 text-sm text-amber-200">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0"/>
            <div className="flex-1">
              <span className="font-semibold text-amber-300">Pre-Alert Warning: </span>
              {preAlert.message || "Higher than normal latency detected on core banking services."}
            </div>
          </motion.div>)}
      </AnimatePresence>

      {/* Main Grid: Sidebar + Chat */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left: Incident Intelligence Sidebar (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Active Incident Status Card */}
          <div className="rounded-3xl glass-strong p-5 space-y-4 border border-white/10">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase font-semibold tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-primary"/> Incident Status
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">LIVE SSE</span>
            </div>

            {incident ? (<div className="rounded-2xl bg-gradient-to-b from-red-500/15 to-transparent border border-red-500/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-red-300 uppercase tracking-wide">
                    {incident.type.replace(/_/g, " ")}
                  </span>
                  <span className="rounded-full bg-red-500/20 text-red-300 px-2 py-0.5 text-[10px] font-bold uppercase">
                    {incident.severity || "CRITICAL"}
                  </span>
                </div>

                <div className="text-xs text-muted-foreground space-y-1.5">
                  <div className="flex justify-between">
                    <span>Started:</span>
                    <span className="text-foreground font-medium">
                      {new Date(incident.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Est. Recovery:</span>
                    <span className="text-emerald-400 font-semibold">~{incident.etaMinutes || 10} minutes</span>
                  </div>
                  {incident.rootCause && (<div className="pt-2 border-t border-white/5 text-[11px] text-muted-foreground leading-relaxed">
                      <span className="text-foreground font-medium">Root Cause: </span>
                      {incident.rootCause}
                    </div>)}
                </div>
              </div>) : (<div className="rounded-2xl glass p-4 text-center space-y-2 border border-emerald-500/20">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400 mx-auto">
                  <CheckCircle2 className="h-6 w-6"/>
                </div>
                <div className="text-sm font-semibold text-foreground">No active incidents</div>
                <p className="text-xs text-muted-foreground">
                  All databases, payment gateways, and API workers are operating normally.
                </p>
              </div>)}
          </div>

          {/* Quick Incident Questions */}
          <div className="rounded-3xl glass-strong p-5 space-y-3 border border-white/10">
            <div className="text-xs uppercase font-semibold tracking-wider text-muted-foreground flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5 text-primary"/> Quick Inquiries
            </div>
            <div className="space-y-1.5">
              {quickQuestions.map((q) => (<button key={q} onClick={() => handleQuickQuestion(q)} disabled={typing} className="w-full text-left rounded-xl glass px-3.5 py-2.5 text-xs text-foreground/90 hover:text-foreground hover:bg-white/10 hover:border-primary/40 border border-transparent transition-all flex items-center justify-between group disabled:opacity-50">
                  <span className="truncate pr-2">{q}</span>
                  <span className="text-muted-foreground group-hover:text-primary transition-colors text-sm">→</span>
                </button>))}
            </div>
          </div>

          {/* Shield Architecture Intelligence */}
          <div className="rounded-3xl glass p-4 space-y-2.5 text-xs text-muted-foreground border border-white/5">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-primary"/> Telemetry & RAG Pipeline
            </div>
            <p className="text-[11px] leading-relaxed">
              Shield queries the localized ChromaDB runbook vector store on every request, providing high-precision engineering telemetry.
            </p>
          </div>
        </div>

        {/* Right: Full Shield Chat Panel (8 cols) */}
        <div className="lg:col-span-8">
          <div className="rounded-3xl glass-strong flex flex-col h-[75vh] border border-white/10 overflow-hidden shadow-2xl">
            {/* Chat Header */}
            <div className="p-4 sm:p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                  S
                </div>
                <div>
                  <div className="font-semibold text-sm tracking-tight flex items-center gap-2">
                    Shield — Support Agent
                    <span className="h-2 w-2 rounded-full bg-emerald-400"/>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Connected to RAG Knowledge Engine & n8n Agent
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-primary"/> 256-bit Encrypted
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <AnimatePresence initial={false}>
                {messages.map((m) => (<motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                    {/* Avatar */}
                    <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl font-bold text-xs ${m.role === "shield"
                ? "bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-md"
                : "bg-gradient-to-tr from-teal-400 to-emerald-500 text-slate-950 shadow-md"}`}>
                      {m.role === "shield" ? "S" : user.name.slice(0, 1)}
                    </div>

                    {/* Bubble */}
                    <div className="space-y-1 max-w-[85%] sm:max-w-[75%]">
                      <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === "shield"
                ? "glass border border-white/10 text-foreground"
                : "bg-primary/20 border border-primary/40 text-foreground font-medium"}`}>
                        {m.text}
                      </div>
                      <div className={`text-[10px] text-muted-foreground px-1 ${m.role === "user" ? "text-right" : ""}`}>
                        {m.timestamp}
                      </div>
                    </div>
                  </motion.div>))}
              </AnimatePresence>

              {/* Typing Indicator */}
              {typing && (<motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 items-center">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold text-xs">
                    S
                  </div>
                  <div className="glass rounded-2xl px-4 py-3 flex items-center gap-1.5 border border-white/10">
                    <span className="text-xs text-muted-foreground pr-1">Shield is thinking</span>
                    <Dot delay={0}/>
                    <Dot delay={0.15}/>
                    <Dot delay={0.3}/>
                  </div>
                </motion.div>)}
            </div>

            {/* Input Form */}
            <div className="border-t border-white/5 p-4 sm:p-5 space-y-3 bg-white/[0.01]">
              <form onSubmit={(e) => {
            e.preventDefault();
            send(input);
        }} className="flex gap-2.5">
                <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Shield anything about incidents, payments, or your account..." disabled={typing} className="flex-1 h-12 rounded-2xl bg-white/5 border border-white/10 px-4 text-sm outline-none focus:border-primary/60 focus:bg-white/[0.08] transition disabled:opacity-60"/>
                <button type="submit" disabled={typing || !input.trim()} className="h-12 px-5 rounded-2xl bg-[image:var(--gradient-primary)] text-primary-foreground font-medium shadow-[var(--shadow-glow)] hover:brightness-110 disabled:opacity-50 transition flex items-center justify-center gap-2" aria-label="Send Message">
                  <Send className="h-4 w-4"/>
                  <span className="hidden sm:inline text-xs font-semibold">Send</span>
                </button>
              </form>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary"/>
                  Shield searches runbooks and system logs autonomously.
                </div>
                <div className="hidden sm:block">Press Enter to send</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>);
}
function Dot({ delay = 0 }) {
    return (<motion.span className="h-1.5 w-1.5 rounded-full bg-primary" animate={{ y: [0, -3, 0], opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay }}/>);
}
