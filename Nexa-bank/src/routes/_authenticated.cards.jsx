import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { Snowflake, Flame, Settings2, Eye, Wifi, ShieldCheck, Sun, Moon } from "lucide-react";
import { cards as initialCards, formatINR } from "@/lib/mock-data";
export const Route = createFileRoute("/_authenticated/cards")({
    head: () => ({ meta: [{ title: "Cards — Nexa Bank" }] }),
    component: CardsPage,
});
function CardsPage() {
    const [cards, setCards] = useState(initialCards);
    const [selectedId, setSelectedId] = useState(cards[0].id);
    const [pinVisible, setPinVisible] = useState(false);
    const selected = cards.find((c) => c.id === selectedId);
    const toggleFreeze = (id) => {
        setCards((cs) => cs.map((c) => (c.id === id ? { ...c, frozen: !c.frozen } : c)));
    };
    return (
      <div className="w-full min-w-0 space-y-7 sm:space-y-8">
        <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-medium tracking-[0.16em] text-[#b8f36b]">WALLET</div>
            <h1 className="mt-2 text-3xl font-medium tracking-[-0.05em] sm:text-4xl">Your cards</h1>
            <p className="mt-2 text-sm text-white/45">Manage your cards, permissions and spending limits.</p>
          </div>
          <div className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3.5 py-2 text-xs text-white/55">
            <span className="font-medium text-white/85">{cards.length}</span> cards · <span className="text-[#c4f889]">{cards.filter((card) => !card.frozen).length} active</span>
          </div>
        </motion.header>

        <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3" aria-label="Your bank cards">
          {cards.map((card, index) => {
            const active = selectedId === card.id;
            return (
              <motion.button
                key={card.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ y: -3 }}
                onClick={() => setSelectedId(card.id)}
                aria-pressed={active}
                className={`relative aspect-[1.72/1] min-w-0 overflow-hidden rounded-[24px] border p-5 text-left shadow-[0_20px_60px_-35px_rgba(0,0,0,0.9)] transition sm:p-6 ${active ? "border-[#b8f36b]/50 ring-1 ring-[#b8f36b]/20" : "border-white/[0.08] hover:border-white/20"}`}
                style={{ background: card.gradient }}
              >
                <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full border border-white/[0.09]" />
                <div className="pointer-events-none absolute -right-8 -top-16 h-40 w-40 rounded-full border border-white/[0.08]" />
                {card.frozen && (
                  <div className="absolute inset-0 z-10 grid place-items-center bg-[#0b0f14]/55 backdrop-blur-sm">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#0b0f14]/80 px-4 py-2 text-xs font-medium text-white">
                      <Snowflake className="h-3.5 w-3.5 text-[#b8f36b]" /> Card frozen
                    </span>
                  </div>
                )}
                <div className="relative flex h-full flex-col text-white">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/55">{card.tier}</div>
                      <div className="mt-1 text-sm font-semibold">{card.type} card</div>
                    </div>
                    <Wifi className="h-5 w-5 rotate-90 text-white/60" />
                  </div>
                  <div className="mt-auto">
                    <div className="mb-4 h-7 w-10 rounded-md border border-white/20 bg-gradient-to-br from-[#f6e5a7]/90 to-[#bd9c55]/80 shadow-inner" />
                    <div className="text-base font-medium tracking-[0.16em] sm:text-lg">{card.number}</div>
                    <div className="mt-4 flex items-end justify-between gap-3 text-[10px] text-white/70 sm:text-[11px]">
                      <div className="min-w-0"><div className="text-white/40">CARDHOLDER</div><div className="mt-1 truncate tracking-[0.08em]">{card.holder}</div></div>
                      <div className="shrink-0"><div className="text-white/40">EXPIRES</div><div className="mt-1">{card.expiry}</div></div>
                      <div className="shrink-0 text-sm font-semibold italic text-white/90">{card.network}</div>
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </section>

        <section className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]" aria-label="Selected card settings">
          <div className="rounded-[24px] border border-white/[0.08] bg-[#11171d]/90 p-5 sm:p-7">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-medium tracking-[0.15em] text-white/35">CARD PREFERENCES</div>
                <h2 className="mt-1.5 text-lg font-medium">{selected.tier} controls</h2>
              </div>
              <span className={`rounded-full border px-3 py-1.5 text-[10px] font-medium ${selected.frozen ? "border-amber-300/20 bg-amber-300/[0.07] text-amber-200" : "border-[#b8f36b]/20 bg-[#b8f36b]/[0.06] text-[#c4f889]"}`}>
                {selected.frozen ? "Frozen" : "Active"}
              </span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <button onClick={() => toggleFreeze(selected.id)} className="flex min-h-[76px] items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-left transition hover:border-[#b8f36b]/20 hover:bg-white/[0.04]">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${selected.frozen ? "bg-[#b8f36b]/[0.08] text-[#b8f36b]" : "bg-white/[0.05] text-white/60"}`}>
                  {selected.frozen ? <Flame className="h-4 w-4" /> : <Snowflake className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{selected.frozen ? "Unfreeze card" : "Freeze card"}</div>
                  <div className="mt-1 text-xs text-white/40">Block new transactions instantly</div>
                </div>
              </button>
              <button onClick={() => setPinVisible((visible) => !visible)} className="flex min-h-[76px] items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-left transition hover:border-[#b8f36b]/20 hover:bg-white/[0.04]">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-white/60"><Eye className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">View PIN</div>
                  <div className="mt-1 text-xs text-white/40">{pinVisible ? "PIN: 4 8 2 9" : "Reveal your PIN securely"}</div>
                </div>
              </button>
              <ControlToggle icon={Sun} label="International use" desc="Allow overseas transactions" defaultOn />
              <ControlToggle icon={Moon} label="Contactless payments" desc="Enable tap-to-pay" defaultOn />
              <ControlToggle icon={Settings2} label="Online payments" desc="Enable e-commerce transactions" defaultOn />
              <ControlToggle icon={ShieldCheck} label="ATM withdrawals" desc="Cash withdrawals allowed" defaultOn />
            </div>
          </div>

          <div className="flex flex-col rounded-[24px] border border-white/[0.08] bg-[#11171d]/90 p-5 sm:p-7">
            <div>
              <div className="text-[10px] font-medium tracking-[0.15em] text-white/35">SPENDING CONTROL</div>
              <h2 className="mt-1.5 text-lg font-medium">Card limits</h2>
            </div>
            <div className="mt-6 space-y-6">
              <LimitBar label="Daily spend" used={82000} total={selected.limitDaily} />
              <LimitBar label="Online transactions" used={41000} total={selected.limitOnline} />
            </div>
            <button className="mt-7 w-full rounded-xl bg-[#b8f36b] py-3 text-sm font-semibold text-[#14200d] transition hover:bg-[#c9ff83]">Update limits</button>
            <p className="mt-4 text-xs leading-5 text-white/40">Changes take effect immediately. You can revert them at any time in card settings.</p>
            <div className="mt-auto border-t border-white/[0.07] pt-5">
              <div className="flex items-center justify-between text-xs text-white/45"><span>Available daily limit</span><span className="font-medium text-[#c4f889]">{formatINR(selected.limitDaily - 82000)}</span></div>
            </div>
          </div>
        </section>
      </div>
    );
}
function ControlToggle({ icon: Icon, label, desc, defaultOn }) {
    const [on, setOn] = useState(!!defaultOn);
    return (<button type="button" onClick={() => setOn((value) => !value)} aria-pressed={on} className="flex min-h-[76px] items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-left transition hover:border-[#b8f36b]/20 hover:bg-white/[0.04]">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-white/60">
        <Icon className="h-4 w-4"/>
      </div>
      <div className="text-left flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-white/40 truncate">{desc}</div>
      </div>
      <div className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-[#b8f36b]" : "bg-white/10"}`}>
        <div className={`absolute top-0.5 h-5 w-5 rounded-full transition ${on ? "left-5 bg-[#14200d]" : "left-0.5 bg-white/75"}`}/>
      </div>
    </button>);
}
function LimitBar({ label, used, total }) {
    const pct = Math.min(100, (used / total) * 100);
    return (<div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-white/50">{label}</span>
        <span className="shrink-0 text-white/75">{formatINR(used)} <span className="text-white/30">/ {formatINR(total)}</span></span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full bg-[#b8f36b] transition-[width]" style={{ width: `${pct}%` }}/>
      </div>
    </div>);
}
