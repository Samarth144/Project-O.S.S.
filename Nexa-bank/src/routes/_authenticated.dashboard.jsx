import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CreditCard,
  Eye,
  EyeOff,
  Home,
  Plus,
  Receipt,
  Send,
  Smartphone,
  TrendingUp,
  Wifi,
  Zap,
} from "lucide-react";
import { useState } from "react";
import {
  useBankStore,
  spendingByMonth,
  spendingByCategory,
  upcomingBills,
  investments,
  formatINR,
  formatINRDetailed,
  user,
} from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Nexa Bank" }] }),
  component: Dashboard,
});

const billIcons = { Home, Smartphone, Wifi, CreditCard };
const cardClass = "rounded-[24px] border border-white/[0.08] bg-[#11171d]/90";

function Dashboard() {
  const { accounts, transactions } = useBankStore();
  const [showBalance, setShowBalance] = useState(true);
  const recent = transactions.slice(0, 5);

  return (
    <div className="mx-auto max-w-[1440px] space-y-7 pb-8 sm:space-y-8">
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-end justify-between gap-5"
      >
        <div>
          <div className="mb-2 text-[11px] font-medium tracking-[0.17em] text-[#b8f36b]">PERSONAL OVERVIEW</div>
          <h1 className="text-2xl font-medium tracking-[-0.045em] sm:text-[32px]">
            Good evening, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1.5 text-sm text-white/45">Here’s your money at a glance.</p>
        </div>
        <Link
          to="/transfer"
          className="inline-flex items-center gap-2.5 rounded-full bg-[#b8f36b] px-5 py-3 text-sm font-semibold text-[#14200d] shadow-[0_8px_30px_-12px_rgba(184,243,107,0.65)] transition hover:bg-[#c9ff83]"
        >
          <Send className="h-4 w-4" /> Send money
        </Link>
      </motion.header>

      {/* Every dashboard row uses the same two-column rhythm. */}
      <section className="grid items-stretch gap-5 xl:grid-cols-2 xl:gap-6" aria-label="Accounts and actions">
        <motion.article
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className={`${cardClass} relative flex min-h-[350px] flex-col overflow-hidden p-5 sm:p-7`}
        >
          <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[#b8f36b]/[0.09] blur-[85px]" />
          <div className="relative flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white/50">Total balance across accounts</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="text-[clamp(2rem,4vw,3.1rem)] font-medium leading-none tracking-[-0.065em]">
                  {showBalance ? formatINRDetailed(accounts.totalBalance) : "₹ • • • • • • •"}
                </p>
                <button
                  onClick={() => setShowBalance((visible) => !visible)}
                  className="grid h-9 w-9 place-items-center rounded-full text-white/45 transition hover:bg-white/[0.06] hover:text-white"
                  aria-label={showBalance ? "Hide balance" : "Show balance"}
                >
                  {showBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <span className="hidden h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#b8f36b]/15 bg-[#b8f36b]/[0.08] text-[#b8f36b] sm:grid">
              <TrendingUp className="h-5 w-5" />
            </span>
          </div>

          <div className="relative mt-4 inline-flex w-fit items-center gap-1.5 rounded-full border border-[#b8f36b]/15 bg-[#b8f36b]/[0.07] px-3 py-1.5 text-xs font-medium text-[#c4f889]">
            <TrendingUp className="h-3.5 w-3.5" /> 4.2% this month
          </div>

          <div className="relative mt-auto grid gap-3 pt-8 sm:grid-cols-3">
            <AccountTile label="Savings" number={accounts.savings.number} amount={accounts.savings.balance} />
            <AccountTile label="Current" number={accounts.current.number} amount={accounts.current.balance} />
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-white/45">Credit card</div>
                <CreditCard className="h-3.5 w-3.5 text-white/35" />
              </div>
              <div className="mt-1 text-[11px] text-white/40">{accounts.credit.number}</div>
              <div className="mt-3 text-base font-medium">
                {formatINR(accounts.credit.used)} <span className="text-[11px] font-normal text-white/40">used</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#b8f36b]"
                  style={{ width: `${(accounts.credit.used / accounts.credit.limit) * 100}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-white/40">
                <span>Limit {formatINR(accounts.credit.limit)}</span>
                <span>Due {accounts.credit.dueDate}</span>
              </div>
            </div>
          </div>
        </motion.article>

        <motion.article
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className={`${cardClass} flex min-h-[350px] flex-col p-5 sm:p-7`}
        >
          <SectionHeading title="Quick actions" eyebrow="YOUR SHORTCUTS" />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <QuickAction to="/transfer" icon={Send} label="Send money" />
            <QuickAction to="/transactions" icon={Receipt} label="Statement" />
            <QuickAction to="/cards" icon={CreditCard} label="Cards" />
            <QuickAction to="/beneficiaries" icon={Plus} label="Add payee" />
          </div>
          <div className="mt-6 border-t border-white/[0.07] pt-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium">Upcoming bills</h2>
              <CalendarDays className="h-4 w-4 text-white/35" />
            </div>
            <div className="space-y-2">
              {upcomingBills.slice(0, 2).map((bill) => {
                const Icon = billIcons[bill.icon] ?? Home;
                return (
                  <div key={bill.name} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-white/65">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{bill.name}</p>
                      <p className="mt-0.5 text-[10px] text-white/40">Due {bill.due}</p>
                    </div>
                    <p className="text-xs font-medium">{formatINR(bill.amount)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.article>
      </section>

      <section className="grid items-stretch gap-5 xl:grid-cols-2 xl:gap-6" aria-label="Spending overview">
        <motion.article
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className={`${cardClass} min-h-[370px] p-5 sm:p-7`}
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-medium tracking-[0.15em] text-white/35">CASH FLOW</p>
              <h2 className="mt-1.5 text-lg font-medium tracking-tight">Monthly activity</h2>
              <p className="mt-1 text-xs text-white/45">{formatINR(102400)} <span className="text-white/30">spent this month</span></p>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-white/55">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#b8f36b]" /> Spend</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#91a9c3]" /> Income</span>
            </div>
          </div>
          <div className="mt-6 h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spendingByMonth} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashboard-spend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#b8f36b" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#b8f36b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dashboard-income" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#91a9c3" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#91a9c3" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="month" stroke="#69747e" fontSize={11} tickLine={false} axisLine={false} tickMargin={10} />
                <YAxis stroke="#69747e" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "#11171d", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, color: "white", fontSize: 12 }}
                  formatter={(value) => formatINR(Number(value))}
                  labelStyle={{ color: "rgba(255,255,255,0.5)", marginBottom: 4 }}
                />
                <Area isAnimationActive={false} type="monotone" dataKey="income" name="Income" stroke="#91a9c3" fill="url(#dashboard-income)" strokeWidth={2} />
                <Area isAnimationActive={false} type="monotone" dataKey="spend" name="Spend" stroke="#b8f36b" fill="url(#dashboard-spend)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.article>

        <motion.article
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className={`${cardClass} flex min-h-[370px] flex-col p-5 sm:p-7`}
        >
          <SectionHeading title="Spending by category" eyebrow="WHERE IT GOES" />
          <div className="grid flex-1 items-center gap-4 sm:grid-cols-[1fr_1fr]">
            <div className="relative mx-auto h-[210px] w-full max-w-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie isAnimationActive={false} data={spendingByCategory} dataKey="value" innerRadius={66} outerRadius={91} paddingAngle={3} stroke="none">
                    {spendingByCategory.map((category) => <Cell key={category.name} fill={category.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#11171d", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "white", fontSize: 12 }}
                    formatter={(value) => formatINR(Number(value))}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] text-white/40">Total spend</span>
                <span className="mt-1 text-lg font-medium tracking-tight">{formatINR(102400)}</span>
              </div>
            </div>
            <div className="space-y-3">
              {spendingByCategory.map((category) => (
                <div key={category.name} className="flex items-center gap-2.5 text-xs">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: category.color }} />
                  <span className="min-w-0 flex-1 truncate text-white/65">{category.name}</span>
                  <span className="shrink-0 font-medium text-white/80">{formatINR(category.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.article>
      </section>

      <section className="grid items-stretch gap-5 xl:grid-cols-2 xl:gap-6" aria-label="Activity and investments">
        <motion.article
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`${cardClass} min-h-[350px] p-5 sm:p-7`}
        >
          <div className="flex items-end justify-between gap-3">
            <SectionHeading title="Recent transactions" eyebrow="LATEST ACTIVITY" />
            <Link to="/transactions" className="mb-1 inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-[#b8f36b] transition hover:text-[#d5ff9e]">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-5 divide-y divide-white/[0.06]">
            {recent.map((transaction) => {
              const credit = transaction.type === "credit";
              const Icon = credit ? ArrowDownLeft : ArrowUpRight;
              return (
                <div key={transaction.id} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${credit ? "bg-[#b8f36b]/[0.09] text-[#b8f36b]" : "bg-white/[0.045] text-white/55"}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{transaction.title}</p>
                    <p className="mt-1 truncate text-[11px] text-white/40">{transaction.category} · {transaction.method}</p>
                  </div>
                  <p className={`shrink-0 text-sm font-medium ${credit ? "text-[#b8f36b]" : "text-white/80"}`}>
                    {credit ? "+" : "−"}{formatINR(transaction.amount)}
                  </p>
                </div>
              );
            })}
          </div>
        </motion.article>

        <motion.article
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className={`${cardClass} min-h-[350px] p-5 sm:p-7`}
        >
          <SectionHeading title="Your wealth" eyebrow="SAVINGS & INVESTMENTS" />
          <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {investments.map((investment) => (
              <div key={investment.name} className="flex min-h-[72px] items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#b8f36b]/[0.08] text-[#b8f36b]"><TrendingUp className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{investment.name}</p>
                  <p className="mt-1 text-[10px] text-[#b8f36b]">+{investment.change}%</p>
                </div>
                <p className="shrink-0 text-xs font-medium">{formatINR(investment.value)}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-2.5 border-t border-white/[0.07] pt-4 sm:grid-cols-2">
            <Insight icon={Zap} title="Spending down 12%" body="You spent ₹14k less than last month on dining." />
            <Insight icon={Check} title="Great savings rate" body="You saved 38% of your July income." />
          </div>
        </motion.article>
      </section>
    </div>
  );
}

function SectionHeading({ title, eyebrow }) {
  return (
    <div>
      <p className="text-[10px] font-medium tracking-[0.15em] text-white/35">{eyebrow}</p>
      <h2 className="mt-1.5 text-lg font-medium tracking-tight">{title}</h2>
    </div>
  );
}

function AccountTile({ label, number, amount }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/45">{label}</p>
        <span className="h-1.5 w-1.5 rounded-full bg-[#b8f36b]" />
      </div>
      <p className="mt-1 text-[11px] text-white/40">{number}</p>
      <p className="mt-3 text-base font-medium">{formatINR(amount)}</p>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label }) {
  return (
    <Link
      to={to}
      className="group flex min-h-[72px] items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 transition hover:border-[#b8f36b]/25 hover:bg-[#b8f36b]/[0.04]"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#b8f36b]/[0.09] text-[#b8f36b] transition group-hover:bg-[#b8f36b] group-hover:text-[#14200d]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-xs font-medium text-white/80">{label}</span>
      <ArrowRight className="ml-auto h-3.5 w-3.5 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-[#b8f36b]" />
    </Link>
  );
}

function Insight({ icon: Icon, title, body }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 rounded-xl bg-white/[0.025] p-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#b8f36b]/[0.09] text-[#b8f36b]"><Icon className="h-3.5 w-3.5" /></span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium">{title}</p>
        <p className="mt-1 text-[10px] leading-4 text-white/40">{body}</p>
      </div>
    </div>
  );
}
