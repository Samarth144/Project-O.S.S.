import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import {
  ArrowUpRight, ArrowDownLeft, Send, Plus, Smartphone, Wifi, Home, CreditCard,
  Eye, EyeOff, TrendingUp, Zap, Receipt, Sparkles,
} from "lucide-react";
import { useState } from "react";
import {
  accounts, spendingByMonth, spendingByCategory, transactions, upcomingBills,
  investments, formatINR, formatINRDetailed, user,
} from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Dashboard — Nexa Bank" }] }),
  component: Dashboard,
});

const billIcons: Record<string, typeof Home> = { Home, Smartphone, Wifi, CreditCard };

function Dashboard() {
  const [showBalance, setShowBalance] = useState(true);
  const recent = transactions.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <div className="text-sm text-muted-foreground">Good evening</div>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">{user.name.split(" ")[0]}, here's your money.</h1>
        </div>
        <Link
          to="/transfer"
          className="inline-flex items-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110"
        >
          <Send className="h-4 w-4" /> Send money
        </Link>
      </motion.div>

      {/* Balance hero + quick actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="lg:col-span-2 relative overflow-hidden rounded-3xl glass-strong p-6 sm:p-8"
        >
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[image:var(--gradient-primary)] opacity-25 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-[image:var(--gradient-accent)] opacity-20 blur-3xl" />

          <div className="relative flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Total balance across accounts</div>
              <div className="mt-3 flex items-baseline gap-3">
                <div className="text-4xl sm:text-5xl font-semibold tracking-tight">
                  {showBalance ? formatINRDetailed(accounts.totalBalance) : "₹ • • • • • • •"}
                </div>
                <button
                  onClick={() => setShowBalance((s) => !s)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Toggle balance visibility"
                >
                  {showBalance ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/15 text-primary px-2.5 py-1 text-xs font-medium">
                <TrendingUp className="h-3.5 w-3.5" /> +4.2% this month
              </div>
            </div>
          </div>

          <div className="relative mt-8 grid gap-4 sm:grid-cols-3">
            <AccountTile label="Savings" number={accounts.savings.number} amount={accounts.savings.balance} tone="primary" />
            <AccountTile label="Current" number={accounts.current.number} amount={accounts.current.balance} tone="accent" />
            <div className="rounded-2xl glass p-4">
              <div className="text-xs text-muted-foreground">Credit Card</div>
              <div className="mt-1 text-xs">{accounts.credit.number}</div>
              <div className="mt-3 text-lg font-semibold">{formatINR(accounts.credit.used)} <span className="text-xs font-normal text-muted-foreground">used</span></div>
              <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-[image:var(--gradient-primary)]"
                  style={{ width: `${(accounts.credit.used / accounts.credit.limit) * 100}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Limit {formatINR(accounts.credit.limit)}</span>
                <span>Due {accounts.credit.dueDate}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-3xl glass-strong p-6"
        >
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Quick actions</div>
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <QuickAction to="/transfer" icon={Send} label="Send" />
            <QuickAction to="/transactions" icon={Receipt} label="Statement" />
            <QuickAction to="/cards" icon={CreditCard} label="Cards" />
            <QuickAction to="/beneficiaries" icon={Plus} label="Payee" />
          </div>

          <div className="mt-6">
            <div className="text-sm font-medium mb-3">Upcoming bills</div>
            <div className="space-y-2">
              {upcomingBills.map((b) => {
                const Icon = billIcons[b.icon] ?? Home;
                return (
                  <div key={b.name} className="flex items-center gap-3 rounded-xl glass p-3">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/5">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{b.name}</div>
                      <div className="text-xs text-muted-foreground">Due {b.due}</div>
                    </div>
                    <div className="text-sm font-semibold">{formatINR(b.amount)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Spending chart + category */}
      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 rounded-3xl glass-strong p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Monthly spending</div>
              <div className="text-2xl font-semibold mt-1">{formatINR(102400)} <span className="text-xs font-normal text-muted-foreground">this month</span></div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /> Spend</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[oklch(0.65_0.2_285)]" /> Income</span>
            </div>
          </div>
          <div className="mt-6 h-64 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spendingByMonth}>
                <defs>
                  <linearGradient id="grad-spend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3a5" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#22d3a5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad-income" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "#1a1d2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "white" }}
                  formatter={(v) => formatINR(Number(v))}
                />
                <Area isAnimationActive={false} type="monotone" dataKey="income" stroke="#a78bfa" fill="url(#grad-income)" strokeWidth={2} />
                <Area isAnimationActive={false} type="monotone" dataKey="spend" stroke="#22d3a5" fill="url(#grad-spend)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl glass-strong p-6"
        >
          <div className="text-sm text-muted-foreground">Spending by category</div>
          <div className="mt-2 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie isAnimationActive={false} data={spendingByCategory} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={3} stroke="none">
                  {spendingByCategory.map((c, i) => <Cell key={i} fill={c.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-2">
            {spendingByCategory.map((c) => (
              <div key={c.name} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-muted-foreground">{formatINR(c.value)}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Recent transactions + insights */}
      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 rounded-3xl glass-strong p-6"
        >
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Recent transactions</div>
            <Link to="/transactions" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          <div className="mt-4 divide-y divide-white/5">
            {recent.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-3">
                <div className={`grid h-10 w-10 place-items-center rounded-xl ${t.type === "credit" ? "bg-primary/15 text-primary" : "bg-white/5"}`}>
                  {t.type === "credit" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground">{t.category} · {t.method}</div>
                </div>
                <div className={`text-sm font-semibold ${t.type === "credit" ? "text-primary" : ""}`}>
                  {t.type === "credit" ? "+" : "−"}{formatINR(t.amount)}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl glass-strong p-6 space-y-5"
        >
          <div>
            <div className="text-sm font-medium">Investments</div>
            <div className="mt-3 space-y-2">
              {investments.map((inv) => (
                <div key={inv.name} className="flex items-center justify-between rounded-xl glass p-3">
                  <div>
                    <div className="text-sm">{inv.name}</div>
                    <div className="text-xs text-primary">+{inv.change}%</div>
                  </div>
                  <div className="text-sm font-semibold">{formatINR(inv.value)}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium">Account insights</div>
            <div className="mt-3 space-y-3">
              <Insight icon={Zap} title="Spending down 12%" body="You spent ₹14k less than last month on dining." />
              <Insight icon={TrendingUp} title="Great savings rate" body="You saved 38% of your July income." />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function AccountTile({ label, number, amount, tone }: { label: string; number: string; amount: number; tone: "primary" | "accent" }) {
  return (
    <div className="rounded-2xl glass p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        <span className={`h-1.5 w-1.5 rounded-full ${tone === "primary" ? "bg-primary" : "bg-accent"}`} />
      </div>
      <div className="mt-1 text-xs">{number}</div>
      <div className="mt-3 text-lg font-semibold">{formatINR(amount)}</div>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: typeof Send; label: string }) {
  return (
    <Link
      to={to}
      className="group flex flex-col items-center justify-center gap-2 rounded-2xl glass p-4 hover:bg-white/10 transition"
    >
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground group-hover:scale-105 transition">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-xs">{label}</div>
    </Link>
  );
}

function Insight({ icon: Icon, title, body }: { icon: typeof Zap; title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-xl glass p-3">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{body}</div>
      </div>
    </div>
  );
}
