import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";
import { Search, Plus, Pencil, Trash2, X, User } from "lucide-react";
import { beneficiaries as initial } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/beneficiaries")({
  head: () => ({ meta: [{ title: "Beneficiaries — Nexa Bank" }] }),
  component: BeneficiariesPage,
});

type B = (typeof initial)[number];

function BeneficiariesPage() {
  const [list, setList] = useState<B[]>(initial);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<B | null>(null);
  const [open, setOpen] = useState(false);

  const filtered = useMemo(
    () => list.filter((b) => `${b.name} ${b.bank} ${b.nickname}`.toLowerCase().includes(q.toLowerCase())),
    [list, q],
  );

  const save = (b: B) => {
    setList((l) => {
      const i = l.findIndex((x) => x.id === b.id);
      if (i === -1) return [...l, b];
      const next = [...l];
      next[i] = b;
      return next;
    });
    setOpen(false);
    setEditing(null);
  };

  const remove = (id: string) => setList((l) => l.filter((b) => b.id !== id));

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Payees</div>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">Beneficiaries</h1>
        </div>
        <button
          onClick={() => { setEditing({ id: `b${Date.now()}`, name: "", nickname: "", account: "", ifsc: "", bank: "", type: "IMPS" }); setOpen(true); }}
          className="inline-flex items-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground px-4 py-2.5 text-sm font-medium hover:brightness-110"
        >
          <Plus className="h-4 w-4" /> Add beneficiary
        </button>
      </motion.div>

      <div className="rounded-3xl glass-strong p-4 sm:p-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, nickname or bank..."
            className="w-full h-11 rounded-xl bg-white/5 border border-white/10 pl-10 pr-3 text-sm outline-none focus:border-primary/60"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((b) => (
          <motion.div
            key={b.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl glass-strong p-5 flex flex-col gap-4"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-[image:var(--gradient-accent)] text-white font-semibold">
                {b.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{b.name}</div>
                <div className="text-xs text-muted-foreground truncate">{b.nickname} · {b.type}</div>
              </div>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Bank</span><span>{b.bank}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Account</span><span>{b.account}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">IFSC</span><span>{b.ifsc}</span></div>
            </div>
            <div className="mt-auto flex gap-2">
              <button
                onClick={() => { setEditing(b); setOpen(true); }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl glass py-2 text-xs hover:bg-white/10"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button
                onClick={() => remove(b.id)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl glass px-3 py-2 text-xs hover:bg-destructive/20 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-2xl glass p-10 text-center text-sm text-muted-foreground">
            <User className="mx-auto h-6 w-6 opacity-60 mb-2" />
            No beneficiaries found.
          </div>
        )}
      </div>

      <AnimatePresence>
        {open && editing && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-md p-4" onClick={() => setOpen(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-3xl p-6 max-w-md w-full"
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold">{list.find((b) => b.id === editing.id) ? "Edit beneficiary" : "Add beneficiary"}</div>
                <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10"><X className="h-4 w-4" /></button>
              </div>
              <div className="mt-5 space-y-3">
                <BField label="Full name" value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} />
                <BField label="Nickname" value={editing.nickname} onChange={(v) => setEditing({ ...editing, nickname: v })} />
                <BField label="Bank" value={editing.bank} onChange={(v) => setEditing({ ...editing, bank: v })} />
                <div className="grid grid-cols-2 gap-3">
                  <BField label="Account number" value={editing.account} onChange={(v) => setEditing({ ...editing, account: v })} />
                  <BField label="IFSC" value={editing.ifsc} onChange={(v) => setEditing({ ...editing, ifsc: v })} />
                </div>
              </div>
              <div className="mt-6 flex gap-2">
                <button onClick={() => setOpen(false)} className="flex-1 rounded-xl glass py-2.5 text-sm">Cancel</button>
                <button onClick={() => save(editing)} className="flex-1 rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground py-2.5 text-sm font-medium">Save</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm outline-none focus:border-primary/60"
      />
    </div>
  );
}
