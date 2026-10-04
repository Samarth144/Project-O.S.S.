import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronRight,
  CreditCard,
  Fingerprint,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { NexaLogo } from "@/components/NexaLogo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nexa Bank — A clearer way to bank" },
      {
        name: "description",
        content:
          "Nexa brings your everyday banking together, so you can see your money clearly and move it with confidence.",
      },
    ],
  }),
  component: HomePage,
});

const features = [
  {
    icon: Wallet,
    number: "01",
    title: "Everything in one view",
    description:
      "See your accounts, cards, and recent activity together. Know where you stand without the digging.",
  },
  {
    icon: ArrowUpRight,
    number: "02",
    title: "Money moves simply",
    description:
      "Send money, manage the people you pay, and keep track of every transfer in one calm, clear place.",
  },
  {
    icon: BarChart3,
    number: "03",
    title: "A clearer picture",
    description:
      "Understand your spending at a glance with helpful summaries that make everyday decisions easier.",
  },
];

function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#0b0f14] text-white selection:bg-[#b8f36b] selection:text-[#10160c]">
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-48 -top-64 h-[34rem] w-[34rem] rounded-full bg-[#8bd44d]/10 blur-[130px]" />
        <div className="absolute right-[-18rem] top-48 h-[38rem] w-[38rem] rounded-full bg-[#4c78b8]/10 blur-[150px]" />
      </div>

      <div className="relative z-10">
        <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
          <Link to="/" className="flex items-center gap-3" aria-label="Nexa Bank home">
            <NexaLogo size="md" />
          </Link>

          <nav className="hidden items-center gap-8 text-[13px] text-white/60 md:flex" aria-label="Main navigation">
            <a className="transition hover:text-white" href="#why-nexa">Why Nexa</a>
            <a className="transition hover:text-white" href="#how-it-works">How it works</a>
            <a className="transition hover:text-white" href="#security">Security</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden rounded-full px-4 py-2.5 text-[13px] font-medium text-white/70 transition hover:text-white sm:inline-flex">
              Sign in
            </Link>
            <Link to="/login" className="inline-flex items-center gap-2 rounded-full bg-[#b8f36b] px-4 py-2.5 text-[13px] font-semibold text-[#14200d] transition hover:bg-[#c9ff83] sm:px-5">
              Get started <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>

        <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-14 sm:px-8 sm:pb-32 sm:pt-20 lg:grid-cols-[1fr_0.94fr] lg:gap-16 lg:px-12 lg:pb-36 lg:pt-24">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, ease: "easeOut" }}>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3.5 py-2 text-[11px] font-medium tracking-[0.08em] text-white/65">
              <span className="h-1.5 w-1.5 rounded-full bg-[#b8f36b] shadow-[0_0_12px_#b8f36b]" />
              BANKING, WITH MORE CLARITY
            </div>
            <h1 className="max-w-[650px] text-[clamp(3.35rem,7.2vw,6.25rem)] font-medium leading-[0.98] tracking-[-0.075em]">
              Your money.<br />
              <span className="text-[#b8f36b]">One clear</span> view.
            </h1>
            <p className="mt-7 max-w-[470px] text-base leading-7 text-white/55 sm:text-[17px] sm:leading-8">
              Nexa brings everyday banking together—so it’s easier to keep up with your money, make a move, and know what’s next.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link to="/login" className="group inline-flex items-center gap-3 rounded-full bg-[#b8f36b] px-6 py-3.5 text-sm font-semibold text-[#14200d] transition hover:gap-4 hover:bg-[#c9ff83]">
                Explore your account <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#why-nexa" className="inline-flex items-center gap-2 px-3 py-3 text-sm text-white/65 transition hover:text-white">
                See what Nexa does <ChevronRight className="h-4 w-4" />
              </a>
            </div>
            <div className="mt-12 flex items-center gap-3 text-xs text-white/45">
              <span className="flex -space-x-2" aria-hidden="true">
                <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-[#0b0f14] bg-[#d5b19a] text-[9px] font-semibold text-[#2b201a]">A</span>
                <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-[#0b0f14] bg-[#9cb7b1] text-[9px] font-semibold text-[#14201d]">M</span>
                <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-[#0b0f14] bg-[#b4a4d4] text-[9px] font-semibold text-[#21192e]">R</span>
              </span>
              <span>Made for the way you bank today</span>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 24, rotate: 1.5 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: 0.75, delay: 0.12, ease: "easeOut" }} className="relative mx-auto w-full max-w-[520px]">
            <div className="absolute -inset-8 rounded-[3rem] bg-[#a6e95d]/[0.075] blur-3xl" />
            <div className="relative rounded-[28px] border border-white/[0.11] bg-[#11171d]/95 p-4 shadow-[0_35px_100px_-36px_rgba(0,0,0,0.9)] sm:rounded-[32px] sm:p-6">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-5">
                <div className="flex items-center gap-2.5">
                  <NexaLogo size="sm" showName={false} />
                  <span className="text-sm font-semibold tracking-tight">Nexa</span>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-[10px] text-white/55"><span className="h-1.5 w-1.5 rounded-full bg-[#b8f36b]" /> Overview</div>
              </div>

              <div className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-white/45">Your total balance</p>
                    <p className="mt-2 text-[34px] font-medium tracking-[-0.06em] sm:text-[42px]">₹ 2,48,560<span className="text-white/35">.00</span></p>
                  </div>
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.055] text-white/65"><ArrowUpRight className="h-4 w-4" /></span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3.5 sm:p-4">
                    <div className="flex items-center gap-2 text-[11px] text-white/45"><span className="grid h-6 w-6 place-items-center rounded-lg bg-[#b8f36b]/10 text-[#b8f36b]"><Wallet className="h-3 w-3" /></span> Savings</div>
                    <div className="mt-3 text-sm font-medium">₹ 1,82,400</div>
                  </div>
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3.5 sm:p-4">
                    <div className="flex items-center gap-2 text-[11px] text-white/45"><span className="grid h-6 w-6 place-items-center rounded-lg bg-[#9e8aff]/10 text-[#b7a9ff]"><CreditCard className="h-3 w-3" /></span> Card balance</div>
                    <div className="mt-3 text-sm font-medium">₹ 66,160</div>
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-between">
                  <span className="text-xs font-medium text-white/75">Recent activity</span>
                  <span className="text-[10px] text-white/35">View all</span>
                </div>
                <div className="mt-3 space-y-1">
                  <Transaction icon={ArrowDownLeft} title="Salary credited" meta="Today · Income" amount="+ ₹ 78,000" positive />
                  <Transaction icon={ArrowUpRight} title="Coffee House" meta="Yesterday · Food & drink" amount="− ₹ 420" />
                </div>
              </div>
            </div>
            <div className="absolute -right-3 top-20 hidden items-center gap-2.5 rounded-2xl border border-white/10 bg-[#1a2228] px-4 py-3 shadow-xl sm:flex lg:-right-8">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#b8f36b]/10 text-[#b8f36b]"><Check className="h-4 w-4" /></span>
              <span className="text-xs font-medium">Transfer complete</span>
            </div>
          </motion.div>
        </section>

        <section id="why-nexa" className="border-y border-white/[0.07] bg-white/[0.018]">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-12">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
              <div>
                <p className="text-[11px] font-medium tracking-[0.18em] text-[#b8f36b]">A BANKING HOME FOR REAL LIFE</p>
                <h2 className="mt-5 max-w-md text-4xl font-medium leading-[1.08] tracking-[-0.055em] sm:text-5xl">Less time managing money. More room to live.</h2>
                <p className="mt-5 max-w-md text-sm leading-7 text-white/50">Your financial life shouldn’t feel scattered. Nexa gives your everyday money a home, with the tools to manage it in a way that feels straightforward.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {features.map(({ icon: Icon, number, title, description }) => (
                  <article key={number} className="rounded-2xl border border-white/[0.08] bg-[#11171d]/65 p-5 sm:p-5">
                    <div className="flex items-center justify-between">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#b8f36b]/10 text-[#b8f36b]"><Icon className="h-[18px] w-[18px]" /></span>
                      <span className="text-[10px] tracking-[0.12em] text-white/25">{number}</span>
                    </div>
                    <h3 className="mt-8 text-[15px] font-medium tracking-tight">{title}</h3>
                    <p className="mt-2 text-xs leading-5 text-white/45">{description}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[1fr_auto] lg:items-center lg:px-12">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-medium text-[#b8f36b]"><Sparkles className="h-4 w-4" /> BANKING THAT FEELS IN YOUR HANDS</div>
            <h2 className="mt-5 text-3xl font-medium tracking-[-0.05em] sm:text-4xl">A little more in control, every day.</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/50">From checking your balance to reviewing a payment, Nexa keeps the essentials close and the details easy to understand.</p>
          </div>
          <Link to="/login" className="inline-flex w-fit items-center gap-3 rounded-full border border-white/15 px-5 py-3 text-sm font-medium transition hover:border-[#b8f36b]/50 hover:bg-[#b8f36b]/[0.06]">
            Take a look inside <ArrowRight className="h-4 w-4 text-[#b8f36b]" />
          </Link>
        </section>

        <section id="security" className="border-t border-white/[0.07]">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-7 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
            <div className="flex items-center gap-2.5"><Fingerprint className="h-4 w-4 text-[#b8f36b]" /><span>Designed with your privacy and account security in mind.</span></div>
            <div className="flex items-center gap-5"><Link to="/login" className="transition hover:text-white/75">Sign in</Link><span>© 2026 Nexa Bank</span></div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Transaction({ icon: Icon, title, meta, amount, positive = false }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2.5">
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${positive ? "bg-[#b8f36b]/10 text-[#b8f36b]" : "bg-white/[0.055] text-white/60"}`}><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{title}</p><p className="mt-1 truncate text-[10px] text-white/35">{meta}</p></div>
      <p className={`shrink-0 text-xs font-medium ${positive ? "text-[#b8f36b]" : "text-white/75"}`}>{amount}</p>
    </div>
  );
}
