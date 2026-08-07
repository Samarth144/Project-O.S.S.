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

  const selected = cards.find((c) => c.id === selectedId)!;

  const toggleFreeze = (id: string) => {
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, frozen: !c.frozen } : c)));
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-sm text-muted-foreground">Wallet</div>
        <h1 className="text-3xl font-semibold tracking-tight mt-1">Your cards</h1>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {cards.map((c, i) => (
          <motion.button
            key={c.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ y: -4 }}
            onClick={() => setSelectedId(c.id)}
            className={`relative text-left rounded-3xl p-6 aspect-[1.586/1] overflow-hidden shadow-[var(--shadow-card)] ${selectedId === c.id ? "ring-2 ring-primary/60" : ""}`}
            style={{ background: c.gradient }}
          >
            {c.frozen && (
              <div className="absolute inset-0 z-10 backdrop-blur-md bg-white/10 grid place-items-center">
                <div className="flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-xs">
                  <Snowflake className="h-3.5 w-3.5" /> Frozen
                </div>
              </div>
            )}
            <div className="relative flex flex-col h-full text-white">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-widest opacity-70">{c.tier}</div>
                  <div className="mt-0.5 text-sm font-semibold">{c.type} Card</div>
                </div>
                <Wifi className="h-5 w-5 rotate-90 opacity-70" />
              </div>
              <div className="mt-auto space-y-3">
                <div className="text-lg tracking-widest font-medium">{c.number}</div>
                <div className="flex items-end justify-between text-xs opacity-80">
                  <div>
                    <div className="opacity-70">Holder</div>
                    <div className="tracking-wider">{c.holder}</div>
                  </div>
                  <div>
                    <div className="opacity-70">Expires</div>
                    <div>{c.expiry}</div>
                  </div>
                  <div className="text-sm font-semibold italic">{c.network}</div>
                </div>
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Controls */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-3xl glass-strong p-6 space-y-4">
          <div className="text-sm font-medium">Card controls · {selected.tier}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => toggleFreeze(selected.id)}
              className="flex items-center gap-3 rounded-2xl glass p-4 hover:bg-white/10"
            >
              <div className={`grid h-10 w-10 place-items-center rounded-xl ${selected.frozen ? "bg-[oklch(0.7_0.16_220)_/_20%] text-[oklch(0.8_0.16_220)]" : "bg-white/5"}`}>
                {selected.frozen ? <Flame className="h-4 w-4" /> : <Snowflake className="h-4 w-4" />}
              </div>
              <div className="text-left flex-1">
                <div className="text-sm font-medium">{selected.frozen ? "Unfreeze card" : "Freeze card"}</div>
                <div className="text-xs text-muted-foreground">Instantly block all new transactions</div>
              </div>
            </button>

            <button onClick={() => setPinVisible((v) => !v)} className="flex items-center gap-3 rounded-2xl glass p-4 hover:bg-white/10">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/5">
                <Eye className="h-4 w-4" />
              </div>
              <div className="text-left flex-1">
                <div className="text-sm font-medium">View PIN</div>
                <div className="text-xs text-muted-foreground">{pinVisible ? "PIN: 4 8 2 9" : "Tap to reveal securely"}</div>
              </div>
            </button>

            <ControlToggle icon={Sun} label="International use" desc="Allow overseas transactions" defaultOn />
            <ControlToggle icon={Moon} label="Contactless payments" desc="Enable tap-to-pay" defaultOn />
            <ControlToggle icon={Settings2} label="Online payments" desc="Enable e-commerce transactions" defaultOn />
            <ControlToggle icon={ShieldCheck} label="ATM withdrawals" desc="Cash withdrawals allowed" defaultOn />
          </div>
        </div>

        <div className="rounded-3xl glass-strong p-6 space-y-4">
          <div className="text-sm font-medium">Card limits</div>
          <LimitBar label="Daily spend" used={82000} total={selected.limitDaily} />
          <LimitBar label="Online transactions" used={41000} total={selected.limitOnline} />
          <div className="pt-2">
            <button className="w-full rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground py-2.5 text-sm font-medium hover:brightness-110">
              Update limits
            </button>
          </div>
          <div className="text-xs text-muted-foreground pt-2">
            Changes take effect immediately. You can revert at any time from card settings.
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Card status: <span className="text-foreground">{selected.frozen ? "Frozen" : "Active"}</span> · Available limit: <span className="text-foreground">{formatINR(selected.limitDaily - 82000)}</span>
      </div>
    </div>
  );
}

function ControlToggle({ icon: Icon, label, desc, defaultOn }: { icon: typeof Sun; label: string; desc: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <button onClick={() => setOn((o) => !o)} className="flex items-center gap-3 rounded-2xl glass p-4 hover:bg-white/10">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/5">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-left flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground truncate">{desc}</div>
      </div>
      <div className={`relative h-6 w-11 rounded-full transition ${on ? "bg-primary" : "bg-white/10"}`}>
        <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${on ? "left-5" : "left-0.5"}`} />
      </div>
    </button>
  );
}

function LimitBar({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = Math.min(100, (used / total) * 100);
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span>{formatINR(used)} / {formatINR(total)}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-[image:var(--gradient-primary)]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
