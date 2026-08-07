import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, Send, CreditCard, Bell, Shield, TrendingUp, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { notifications } from "@/lib/mock-data";
import { useIncidentBus } from "@/hooks/useIncidentBus";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Nexa Bank" }] }),
  component: NotificationsPage,
});

const iconMap = { Wallet, Send, CreditCard, Bell, Shield, TrendingUp, FileText } as const;
const toneMap = {
  success: "bg-primary/15 text-primary",
  info: "bg-[oklch(0.65_0.2_285)_/_15%] text-[oklch(0.8_0.18_285)]",
  warning: "bg-[oklch(0.8_0.16_80)_/_15%] text-[oklch(0.85_0.16_80)]",
} as const;

function NotificationsPage() {
  const { incident, preAlert, justResolved } = useIncidentBus();

  // Build live notification if incident or recovery is active
  const liveNotification = (() => {
    if (justResolved) {
      return {
        id: "live-resolved",
        title: "Service Restored",
        body: "All banking services are fully operational. You may retry any pending transactions.",
        time: "Just now",
        type: "success" as const,
        icon: "Shield" as const,
      };
    }
    if (incident) {
      return {
        id: "live-incident",
        title: "Service Notice",
        body: "We are experiencing a temporary interruption. Your money is safe and our team is working to resolve this.",
        time: "Just now",
        type: "warning" as const,
        icon: "Bell" as const,
      };
    }
    if (preAlert) {
      return {
        id: "live-prealert",
        title: "Monitoring Alert",
        body: "We are monitoring a brief service anomaly. Services remain available.",
        time: "Just now",
        type: "warning" as const,
        icon: "Shield" as const,
      };
    }
    return null;
  })();

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Activity</div>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">Notifications</h1>
        </div>
        <button className="text-sm text-primary hover:underline">Mark all as read</button>
      </motion.div>

      <div className="rounded-3xl glass-strong overflow-hidden">
        <div className="divide-y divide-white/5">

          {/* Live incident notification — injected at top, animated */}
          <AnimatePresence>
            {liveNotification && (
              <motion.div
                key={liveNotification.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className={`flex items-start gap-4 p-5 ${liveNotification.type === "warning" ? "bg-[oklch(0.8_0.16_80)_/_5%]" : "bg-primary/5"}`}
              >
                <div className={`grid h-11 w-11 place-items-center rounded-2xl shrink-0 ${toneMap[liveNotification.type]}`}>
                  {liveNotification.type === "success" ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{liveNotification.title}</div>
                    <span className="text-xs text-muted-foreground">· {liveNotification.time}</span>
                    <span className="text-xs rounded-full bg-primary/20 text-primary px-2 py-0.5">Live</span>
                  </div>
                  <div className="mt-0.5 text-sm text-muted-foreground">{liveNotification.body}</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Static mock notifications */}
          {notifications.map((n, i) => {
            const Icon = iconMap[n.icon as keyof typeof iconMap] ?? Bell;
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-start gap-4 p-5 hover:bg-white/5"
              >
                <div className={`grid h-11 w-11 place-items-center rounded-2xl shrink-0 ${toneMap[n.type as keyof typeof toneMap]}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{n.title}</div>
                    <span className="text-xs text-muted-foreground">· {n.time}</span>
                  </div>
                  <div className="mt-0.5 text-sm text-muted-foreground">{n.body}</div>
                </div>
                <button className="text-xs text-muted-foreground hover:text-foreground">View</button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


