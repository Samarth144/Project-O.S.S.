import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, Send, CreditCard, Bell, Shield, TrendingUp, FileText, AlertTriangle, CheckCircle2, Check, Inbox } from "lucide-react";
import { notifications } from "@/lib/mock-data";
import { useIncidentBus } from "@/hooks/useIncidentBus";
export const Route = createFileRoute("/_authenticated/notifications")({
    head: () => ({ meta: [{ title: "Notifications — Nexa Bank" }] }),
    component: NotificationsPage,
});
const iconMap = { Wallet, Send, CreditCard, Bell, Shield, TrendingUp, FileText };
const toneMap = {
    success: "border-[#b8f36b]/15 bg-[#b8f36b]/[0.08] text-[#b8f36b]",
    info: "border-sky-300/15 bg-sky-300/[0.07] text-sky-200",
    warning: "border-amber-300/15 bg-amber-300/[0.07] text-amber-200",
};
function NotificationsPage() {
    const { incident, preAlert, justResolved } = useIncidentBus();
    const liveNotification = (() => {
        if (justResolved) return { id: "live-resolved", title: "Service Restored", body: "All banking services are fully operational. You may retry any pending transactions.", time: "Just now", type: "success", icon: "Shield" };
        if (incident) return { id: "live-incident", title: "Service Notice", body: "We are experiencing a temporary interruption. Your money is safe and our team is working to resolve this.", time: "Just now", type: "warning", icon: "Bell" };
        if (preAlert) return { id: "live-prealert", title: "Monitoring Alert", body: "We are monitoring a brief service anomaly. Services remain available.", time: "Just now", type: "warning", icon: "Shield" };
        return null;
    })();
    return (<div className="w-full min-w-0 space-y-7 sm:space-y-8">
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div><div className="text-[11px] font-medium tracking-[0.16em] text-[#b8f36b]">YOUR ACTIVITY</div><h1 className="mt-2 text-3xl font-medium tracking-[-0.05em] sm:text-4xl">Notifications</h1><p className="mt-2 text-sm text-white/45">Updates about your money, account and Nexa services.</p></div>
        <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 py-2.5 text-sm text-white/65 transition hover:border-[#b8f36b]/25 hover:text-[#c4f889]"><Check className="h-4 w-4"/> Mark all as read</button>
      </motion.header>
      <div className="grid gap-4 sm:grid-cols-3">
        <Summary icon={Inbox} label="All updates" value={notifications.length + (liveNotification ? 1 : 0)} detail="Across your account" />
        <Summary icon={Shield} label="Account security" value="Protected" detail="Alerts are enabled" />
        <Summary icon={Bell} label="Service status" value={incident ? "Attention" : "Operational"} detail={incident ? "A live update is available" : "No active service issues"} />
      </div>
      <section className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#11171d]/90" aria-label="Notification list">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4 sm:px-6"><div className="text-sm font-medium">Recent updates</div><div className="text-xs text-white/35">Newest first</div></div>
        <div className="divide-y divide-white/[0.06]">
          <AnimatePresence>
            {liveNotification && (<motion.div key={liveNotification.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="flex items-start gap-4 bg-[#b8f36b]/[0.035] p-5 sm:px-6">
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border ${toneMap[liveNotification.type]}`}>{liveNotification.type === "success" ? <CheckCircle2 className="h-5 w-5"/> : <AlertTriangle className="h-5 w-5"/>}</div>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><div className="font-medium text-white/90">{liveNotification.title}</div><span className="text-xs text-white/35">· {liveNotification.time}</span><span className="rounded-full border border-[#b8f36b]/20 bg-[#b8f36b]/[0.07] px-2 py-0.5 text-[10px] font-medium text-[#c4f889]">LIVE</span></div><div className="mt-1 text-sm leading-6 text-white/50">{liveNotification.body}</div></div>
              </motion.div>)}
          </AnimatePresence>
          {notifications.map((n, i) => { const Icon = iconMap[n.icon] ?? Bell; return (<motion.article key={n.id} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="group flex items-start gap-4 p-5 transition-colors hover:bg-white/[0.025] sm:px-6">
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border ${toneMap[n.type] ?? toneMap.info}`}><Icon className="h-5 w-5"/></div>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><div className="font-medium text-white/85">{n.title}</div><span className="text-xs text-white/35">· {n.time}</span></div><div className="mt-1 text-sm leading-6 text-white/50">{n.body}</div></div>
              <button type="button" className="shrink-0 rounded-lg px-2 py-1 text-xs text-white/40 transition hover:bg-white/[0.06] hover:text-[#c4f889]">View</button>
            </motion.article>); })}
        </div>
      </section>
    </div>);
}
function Summary({ icon: Icon, label, value, detail }) {
    return (<div className="flex items-center gap-3.5 rounded-[20px] border border-white/[0.08] bg-[#11171d]/80 p-4 sm:p-5"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#b8f36b]/[0.08] text-[#b8f36b]"><Icon className="h-4 w-4"/></div><div className="min-w-0"><div className="text-xs text-white/40">{label}</div><div className="mt-0.5 truncate text-sm font-medium text-white/85">{value}<span className="ml-2 text-[11px] font-normal text-white/35">{detail}</span></div></div></div>);
}
