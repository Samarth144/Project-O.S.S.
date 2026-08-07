import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Receipt,
  CreditCard,
  Users,
  Bell,
  Bot,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { signOut } from "@/lib/auth";
import { user } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useIncidentBus } from "@/hooks/useIncidentBus";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transfer", label: "Transfer Money", icon: ArrowLeftRight },
  { to: "/transactions", label: "Transactions", icon: Receipt },
  { to: "/cards", label: "Cards", icon: CreditCard },
  { to: "/beneficiaries", label: "Beneficiaries", icon: Users },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/support", label: "AI Support", icon: Bot },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

// ─── Recovery Banner ─────────────────────────────────────────────────────────

const INCIDENT_MESSAGES: Record<string, { short: string; detail: string }> = {
  payment_down: {
    short: "Payment services temporarily unavailable",
    detail: "Your account has not been charged. Our automated recovery system is restoring the service.",
  },
  db_down: {
    short: "Temporary service interruption",
    detail: "Your money is safe. No changes have been made to your account. We're working on a fix.",
  },
  api_timeout: {
    short: "Services are responding slowly",
    detail: "Please wait a moment. Your transactions are safe and will be processed once the service recovers.",
  },
  high_error_rate: {
    short: "Higher than normal traffic detected",
    detail: "Some requests may be delayed. Please try again in a few minutes.",
  },
  service_degradation: {
    short: "Some services are temporarily degraded",
    detail: "Our team is actively working to restore full service. Your data is safe.",
  },
  default: {
    short: "Temporary service interruption detected",
    detail: "Our automated recovery system is working to restore services. Your money is safe.",
  },
};

function RecoveryBanner() {
  const { incident, preAlert, justResolved, backendOffline } = useIncidentBus();

  const hasContent = incident || preAlert || justResolved || backendOffline;

  const getBannerConfig = () => {
    if (backendOffline) {
      return {
        icon: WifiOff,
        color: "border-[oklch(0.63_0.22_25)_/_40%] bg-[oklch(0.63_0.22_25)_/_8%]",
        iconColor: "text-[oklch(0.75_0.2_25)]",
        short: "Unable to reach banking services",
        detail: "Please check your connection. Attempting to reconnect...",
        spinning: true,
      };
    }
    if (justResolved) {
      return {
        icon: CheckCircle2,
        color: "border-primary/40 bg-primary/8",
        iconColor: "text-primary",
        short: "Service fully restored",
        detail: "All banking systems are operational. You can retry your transaction.",
        spinning: false,
      };
    }
    if (incident) {
      const msgs = INCIDENT_MESSAGES[incident.type] ?? INCIDENT_MESSAGES.default;
      return {
        icon: RefreshCw,
        color: "border-[oklch(0.8_0.16_80)_/_40%] bg-[oklch(0.8_0.16_80)_/_8%]",
        iconColor: "text-[oklch(0.85_0.16_80)]",
        short: msgs.short,
        detail: msgs.detail,
        spinning: true,
      };
    }
    if (preAlert) {
      return {
        icon: AlertTriangle,
        color: "border-[oklch(0.8_0.16_80)_/_30%] bg-[oklch(0.8_0.16_80)_/_5%]",
        iconColor: "text-[oklch(0.85_0.16_80)]",
        short: "Monitoring a brief service interruption",
        detail: "Services remain available. Your money is safe. We're watching this closely.",
        spinning: false,
      };
    }
    return null;
  };

  const config = getBannerConfig();

  return (
    <AnimatePresence>
      {hasContent && config && (
        <motion.div
          key="recovery-banner"
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={cn(
            "border-b px-4 py-3 overflow-hidden",
            config.color,
          )}
        >
          <div className="mx-auto max-w-7xl flex items-center gap-3">
            <div className={cn("shrink-0", config.iconColor)}>
              <config.icon className={cn("h-4 w-4", config.spinning && "animate-spin")} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium">{config.short}.</span>{" "}
              <span className="text-xs text-muted-foreground">{config.detail}</span>
            </div>
            {incident && (
              <div className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Wifi className="h-3 w-3" />
                Recovery in progress
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Success Popup ─────────────────────────────────────────────────────────────

function SuccessPopup() {
  const { justResolved } = useIncidentBus();

  return (
    <AnimatePresence>
      {justResolved && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="pointer-events-auto flex items-center gap-4 rounded-3xl bg-[oklch(0.1_0_0)] border border-green-500/30 p-5 pr-8 shadow-[0_0_60px_-15px_rgba(34,197,94,0.4)]"
          >
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-green-500/10 text-green-400 shadow-[inset_0_0_20px_rgba(34,197,94,0.1)]">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <div className="text-lg font-semibold text-white tracking-tight">Auto-Heal Successful</div>
              <div className="text-sm text-green-400/80 mt-0.5">All banking services have been fully restored.</div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ─── App Layout ───────────────────────────────────────────────────────────────

export function AppLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { incident } = useIncidentBus();

  const handleLogout = () => {
    signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen w-full text-foreground flex flex-col">
      {/* Global Recovery Banner — always at very top, customer-facing */}
      <RecoveryBanner />
      
      {/* Central Success Popup */}
      <SuccessPopup />

      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-40 glass-strong flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="font-semibold tracking-tight">Nexa Bank</span>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="grid h-10 w-10 place-items-center rounded-xl glass"
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed lg:sticky top-0 left-0 z-50 h-screen w-72 shrink-0 p-4 transition-transform duration-300 lg:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          )}
        >
          <div className="glass-strong flex h-full flex-col rounded-3xl p-5">
            <div className="flex items-center gap-3 px-2 pb-6">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)]">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold tracking-tight">Nexa Bank</div>
                <div className="text-xs text-muted-foreground">Private Banking</div>
              </div>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar">
              {nav.map((item) => {
                // Conditionally hide AI Support if there is no active incident
                if (item.to === "/support" && !incident) return null;

                const active =
                  item.to === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                      active
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5",
                    )}
                  >
                    {active && (
                      <motion.div
                        layoutId="active-nav"
                        className="absolute inset-0 rounded-xl bg-white/10 border border-white/10"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                    <Icon className="relative h-4.5 w-4.5 shrink-0" />
                    <span className="relative">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-4 rounded-2xl glass p-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[image:var(--gradient-accent)] text-white font-semibold text-sm">
                  {user.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{user.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {open && (
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          />
        )}

        {/* Main */}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

