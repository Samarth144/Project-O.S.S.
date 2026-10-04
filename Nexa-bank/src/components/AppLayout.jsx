import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeftRight,
  Bell,
  CheckCircle2,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  RefreshCw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  User,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NexaLogo } from "@/components/NexaLogo";
import { useIncidentBus } from "@/hooks/useIncidentBus";
import { signOut } from "@/lib/auth";
import { user } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const mainNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transfer", label: "Transfer", icon: ArrowLeftRight },
  { to: "/transactions", label: "Transactions", icon: Receipt },
  { to: "/cards", label: "Cards", icon: CreditCard },
  { to: "/beneficiaries", label: "Beneficiaries", icon: Users },
];

const incidentMessages = {
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
  let config = null;

  if (backendOffline) {
    config = {
      icon: WifiOff,
      color: "border-[oklch(0.63_0.22_25)_/_40%] bg-[oklch(0.63_0.22_25)_/_8%]",
      iconColor: "text-[oklch(0.75_0.2_25)]",
      short: "Unable to reach banking services",
      detail: "Please check your connection. Attempting to reconnect...",
      spinning: true,
    };
  } else if (justResolved) {
    config = {
      icon: CheckCircle2,
      color: "border-[#b8f36b]/30 bg-[#b8f36b]/[0.06]",
      iconColor: "text-[#b8f36b]",
      short: "Service fully restored",
      detail: "All banking systems are operational. You can retry your transaction.",
      spinning: false,
    };
  } else if (incident) {
    config = {
      icon: RefreshCw,
      color: "border-[oklch(0.8_0.16_80)_/_40%] bg-[oklch(0.8_0.16_80)_/_8%]",
      iconColor: "text-[oklch(0.85_0.16_80)]",
      ...(incidentMessages[incident.type] ?? incidentMessages.default),
      spinning: true,
    };
  } else if (preAlert) {
    config = {
      icon: AlertTriangle,
      color: "border-[oklch(0.8_0.16_80)_/_30%] bg-[oklch(0.8_0.16_80)_/_5%]",
      iconColor: "text-[oklch(0.85_0.16_80)]",
      short: "Monitoring a brief service interruption",
      detail: "Services remain available. Your money is safe. We're watching this closely.",
      spinning: false,
    };
  }

  return (
    <AnimatePresence>
      {hasContent && config && (
        <motion.div
          key="recovery-banner"
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={cn("overflow-hidden border-b px-4 py-3", config.color)}
        >
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            <div className={cn("shrink-0", config.iconColor)}>
              <config.icon className={cn("h-4 w-4", config.spinning && "animate-spin")} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium">{config.short}.</span>{" "}
              <span className="text-xs text-muted-foreground">{config.detail}</span>
            </div>
            {incident && (
              <div className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                <Wifi className="h-3 w-3" /> Recovery in progress
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SuccessPopup() {
  const { justResolved } = useIncidentBus();
  return (
    <AnimatePresence>
      {justResolved && (
        <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="pointer-events-auto flex items-center gap-4 rounded-3xl border border-[#b8f36b]/25 bg-[#0b0f14] p-5 pr-8 shadow-[0_0_60px_-15px_rgba(184,243,107,0.3)]"
          >
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#b8f36b]/[0.09] text-[#b8f36b]">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight text-white">Auto-Heal Successful</div>
              <div className="mt-0.5 text-sm text-[#b8f36b]/75">All banking services have been fully restored.</div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function IconButton({ to, label, children, dot }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="relative grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:border-[#b8f36b]/40 hover:bg-white/[0.08] hover:text-white"
    >
      {children}
      {dot && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#b8f36b] ring-2 ring-[#0b0f14]" />}
    </Link>
  );
}

export function AppLayout({ children }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const { incident } = useIncidentBus();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    signOut();
    navigate({ to: "/login" });
  };
  const isActive = (to) => pathname === to || pathname.startsWith(`${to}/`);
  const tabs = incident ? [...mainNav, { to: "/support", label: "Shield AI", icon: ShieldAlert }] : mainNav;

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#0b0f14] text-foreground">
      <RecoveryBanner />
      <SuccessPopup />

      <header
        className={cn(
          "sticky top-0 z-50 w-full border-b transition-all duration-300",
          scrolled
            ? "border-white/10 bg-[#0b0f14]/85 shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl"
            : "border-white/[0.06] bg-[#0b0f14]/60 backdrop-blur-md",
        )}
      >
        <div className="mx-auto flex min-h-[92px] max-w-[1536px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/dashboard" className="flex shrink-0 items-center outline-none">
            <NexaLogo size="sm" />
          </Link>

          <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.25)] lg:flex" aria-label="Main navigation">
            {tabs.map(({ to, label, icon: Icon }) => {
              const active = isActive(to);
              return (
                <Link
                  key={to}
                  to={to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors",
                    active ? "text-[#c4f889]" : "text-white/60 hover:text-white",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-full bg-[#b8f36b]/[0.11] ring-1 ring-[#b8f36b]/30"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon className="relative z-10 h-4 w-4" />
                  <span className="relative z-10">{label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              <IconButton to="/notifications" label="Notifications" dot={Boolean(incident)}>
                <Bell className="h-[18px] w-[18px]" />
              </IconButton>
              <IconButton to="/settings" label="Settings">
                <Settings className="h-[18px] w-[18px]" />
              </IconButton>
            </div>

            <div className="relative">
              <button
                onClick={() => setMenuOpen((open) => !open)}
                aria-label="Account menu"
                aria-expanded={menuOpen}
                className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#d5ff83] to-[#8bd44d] text-sm font-bold text-[#14200d] ring-2 ring-white/10 transition hover:ring-[#b8f36b]/50"
              >
                {user.avatar}
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <>
                    <button className="fixed inset-0 z-40 cursor-default" aria-label="Close account menu" onClick={() => setMenuOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 z-50 mt-3 w-52 overflow-hidden rounded-2xl border border-white/10 bg-[#11171d]/95 p-1.5 shadow-2xl backdrop-blur-xl"
                    >
                      <div className="px-3 py-2">
                        <div className="text-xs font-semibold text-white/90">{user.name}</div>
                        <div className="mt-0.5 truncate text-[10px] text-white/45">{user.email}</div>
                      </div>
                      <div className="my-1 h-px bg-white/10" />
                      <Link to="/profile" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/[0.06]">
                        <User className="h-4 w-4" /> Profile
                      </Link>
                      <Link to="/settings" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/[0.06]">
                        <Settings className="h-4 w-4" /> Settings
                      </Link>
                      <div className="my-1 h-px bg-white/10" />
                      <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-rose-300 hover:bg-rose-500/10">
                        <LogOut className="h-4 w-4" /> Sign out
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => setMobileOpen((open) => !open)}
              aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileOpen}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/80 lg:hidden"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {incident && (
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              exit={{ scaleX: 0, opacity: 0 }}
              className="h-[2px] origin-left bg-gradient-to-r from-rose-500 via-orange-400 to-rose-500"
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {mobileOpen && (
            <motion.nav
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden border-t border-white/10 bg-[#0b0f14]/95 backdrop-blur-xl lg:hidden"
              aria-label="Mobile navigation"
            >
              <div className="flex flex-col gap-1 p-3">
                {tabs.map(({ to, label, icon: Icon }) => {
                  const active = isActive(to);
                  return (
                    <Link
                      key={to}
                      to={to}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium",
                        active ? "bg-[#b8f36b]/[0.1] text-[#c4f889]" : "text-white/70 hover:bg-white/[0.05]",
                      )}
                    >
                      <Icon className="h-4 w-4" /> {label}
                    </Link>
                  );
                })}
                <Link to="/notifications" className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white/70 hover:bg-white/[0.05] sm:hidden">
                  <Bell className="h-4 w-4" /> Notifications
                </Link>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className={cn("mx-auto w-full", ["/transfer", "/transactions", "/cards", "/beneficiaries", "/notifications", "/settings", "/profile"].includes(pathname) ? "max-w-none" : "max-w-[1440px]")}>{children}</div>
      </main>
    </div>
  );
}
