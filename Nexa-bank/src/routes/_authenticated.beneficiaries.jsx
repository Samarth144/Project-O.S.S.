import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";
import { Search, Plus, Pencil, Trash2, X, User, Landmark, ArrowUpRight, UsersRound } from "lucide-react";
import { beneficiaries as initial } from "@/lib/mock-data";
export const Route = createFileRoute("/_authenticated/beneficiaries")({
    head: () => ({ meta: [{ title: "Beneficiaries — Nexa Bank" }] }),
    component: BeneficiariesPage,
});
function BeneficiariesPage() {
    const [list, setList] = useState(initial);
    const [q, setQ] = useState("");
    const [editing, setEditing] = useState(null);
    const [open, setOpen] = useState(false);
    const filtered = useMemo(() => list.filter((b) => `${b.name} ${b.bank} ${b.nickname}`.toLowerCase().includes(q.toLowerCase())), [list, q]);
    const save = (b) => {
        setList((l) => {
            const i = l.findIndex((x) => x.id === b.id);
            if (i === -1)
                return [...l, b];
            const next = [...l];
            next[i] = b;
            return next;
        });
        setOpen(false);
        setEditing(null);
    };
    const remove = (id) => setList((l) => l.filter((b) => b.id !== id));
    return (<div className="w-full min-w-0 space-y-7 sm:space-y-8">
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="text-[11px] font-medium tracking-[0.16em] text-[#b8f36b]">PEOPLE & PAYMENTS</div>
          <h1 className="mt-2 text-3xl font-medium tracking-[-0.05em] sm:text-4xl">Beneficiaries</h1>
          <p className="mt-2 text-sm text-white/45">Your trusted people, ready whenever you need to send money.</p>
        </div>
        <button onClick={() => { setEditing({ id: `b${Date.now()}`, name: "", nickname: "", account: "", ifsc: "", bank: "", type: "IMPS" }); setOpen(true); }} className="inline-flex items-center gap-2 rounded-xl bg-[#b8f36b] px-4 py-3 text-sm font-semibold text-[#14200d] transition hover:bg-[#c9ff83]">
          <Plus className="h-4 w-4"/> Add beneficiary
        </button>
      </motion.header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.34fr)]">
        <div className="flex flex-col justify-between gap-5 rounded-[24px] border border-white/[0.08] bg-[#11171d] p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#b8f36b]/[0.09] text-[#b8f36b]"><UsersRound className="h-5 w-5"/></div>
            <div><div className="text-sm font-medium">Your payee list</div><div className="mt-1 text-xs text-white/40">{list.length} saved {list.length === 1 ? "beneficiary" : "beneficiaries"}</div></div>
          </div>
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"/>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people or banks" aria-label="Search beneficiaries" className="h-12 w-full rounded-xl border border-white/[0.09] bg-[#0b0f14] pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#b8f36b]/45"/>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-[24px] border border-[#b8f36b]/15 bg-[#b8f36b]/[0.045] p-5 sm:p-6">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#b8f36b]/20 text-[#b8f36b]"><ArrowUpRight className="h-5 w-5"/></div>
          <div><div className="text-xs text-white/45">Quick access</div><div className="mt-1 text-sm font-medium">Choose a saved payee when you transfer</div></div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Saved beneficiaries">
        {filtered.map((b, index) => (<motion.article key={b.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.035 }} className="group flex min-w-0 flex-col rounded-[24px] border border-white/[0.08] bg-[#11171d]/90 p-5 transition hover:-translate-y-0.5 hover:border-[#b8f36b]/25 sm:p-6">
            <div className="flex items-start gap-3.5">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#b8f36b]/15 bg-[#b8f36b]/[0.08] text-sm font-semibold text-[#c4f889]">
                {b.name.split(" ").map((s) => s[0]).slice(0, 2).join("") || <User className="h-4 w-4"/>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-white/90">{b.name || "Unnamed beneficiary"}</div>
                <div className="mt-1 truncate text-xs text-white/40">{b.nickname || "Saved payee"}</div>
              </div>
              <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[10px] font-medium text-white/45">{b.type}</span>
            </div>
            <div className="my-5 h-px bg-white/[0.07]"/>
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-white/45"><Landmark className="h-4 w-4"/></div>
              <div className="min-w-0"><div className="truncate text-sm font-medium text-white/80">{b.bank || "Bank not set"}</div><div className="mt-1 truncate text-xs text-white/40">A/C {b.account || "—"}</div></div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 text-xs"><span className="text-white/35">IFSC code</span><span className="truncate font-medium tracking-wide text-white/60">{b.ifsc || "—"}</span></div>
            <div className="mt-5 flex gap-2 border-t border-white/[0.07] pt-4">
              <button onClick={() => { setEditing(b); setOpen(true); }} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] py-2.5 text-xs font-medium text-white/65 transition hover:border-[#b8f36b]/25 hover:text-[#c4f889]">
                <Pencil className="h-3.5 w-3.5"/> Edit details
              </button>
              <button onClick={() => remove(b.id)} aria-label={`Remove ${b.name}`} className="grid h-9 w-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-white/40 transition hover:border-rose-400/25 hover:bg-rose-400/[0.06] hover:text-rose-300">
                <Trash2 className="h-3.5 w-3.5"/>
              </button>
            </div>
          </motion.article>))}
        {filtered.length === 0 && (<div className="col-span-full rounded-[24px] border border-white/[0.08] bg-[#11171d] px-6 py-14 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.04] text-white/40"><User className="h-5 w-5"/></div>
            <div className="text-sm font-medium text-white/75">No beneficiaries found</div><p className="mt-1 text-xs text-white/40">Try a different search or add a new beneficiary.</p>
          </div>)}
      </section>

      <AnimatePresence>
        {open && editing && (<div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-md p-4" onClick={() => setOpen(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-[24px] border border-white/10 bg-[#11171d] p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{list.find((b) => b.id === editing.id) ? "Edit beneficiary" : "Add beneficiary"}</div>
                <button onClick={() => setOpen(false)} aria-label="Close dialog" className="grid h-8 w-8 place-items-center rounded-lg text-white/55 hover:bg-white/10"><X className="h-4 w-4"/></button>
              </div>
              <div className="mt-5 space-y-3">
                <BField label="Full name" value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })}/>
                <BField label="Nickname" value={editing.nickname} onChange={(v) => setEditing({ ...editing, nickname: v })}/>
                <BField label="Bank" value={editing.bank} onChange={(v) => setEditing({ ...editing, bank: v })}/>
                <div className="grid grid-cols-2 gap-3">
                  <BField label="Account number" value={editing.account} onChange={(v) => setEditing({ ...editing, account: v })}/>
                  <BField label="IFSC" value={editing.ifsc} onChange={(v) => setEditing({ ...editing, ifsc: v })}/>
                </div>
              </div>
              <div className="mt-6 flex gap-2">
                <button onClick={() => setOpen(false)} className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-sm text-white/70">Cancel</button>
                <button onClick={() => save(editing)} className="flex-1 rounded-xl bg-[#b8f36b] py-2.5 text-sm font-semibold text-[#14200d]">Save beneficiary</button>
              </div>
            </motion.div>
          </div>)}
      </AnimatePresence>
    </div>);
}
function BField({ label, value, onChange }) {
    return (<div>
      <label className="text-xs text-white/50">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 text-sm text-white outline-none focus:border-[#b8f36b]/50"/>
    </div>);
}
