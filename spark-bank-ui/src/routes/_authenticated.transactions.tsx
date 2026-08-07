import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Search, Download, Filter, ArrowUpRight, ArrowDownLeft, X } from "lucide-react";
import { transactions, formatINR, type Txn } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({ meta: [{ title: "Transactions — Nexa Bank" }] }),
  component: TxnPage,
});

const statusColor: Record<Txn["status"], string> = {
  Completed: "bg-primary/15 text-primary",
  Pending: "bg-[oklch(0.8_0.16_80)_/_15%] text-[oklch(0.85_0.16_80)]",
  Failed: "bg-destructive/15 text-destructive",
};

function TxnPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | Txn["status"]>("all");
  const [range, setRange] = useState<"7d" | "30d" | "all">("30d");
  const [selected, setSelected] = useState<Txn | null>(null);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (status !== "all" && t.status !== status) return false;
      if (q && !`${t.title} ${t.category} ${t.id}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (range !== "all") {
        const days = range === "7d" ? 7 : 30;
        const cutoff = Date.now() - days * 86400000;
        if (new Date(t.date).getTime() < cutoff - 365 * 86400000) return false; // demo: keep most
      }
      return true;
    });
  }, [q, status, range]);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">History</div>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">Transactions</h1>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl glass px-4 py-2.5 text-sm hover:bg-white/10">
          <Download className="h-4 w-4" /> Download statement
        </button>
      </motion.div>

      {/* Filters */}
      <div className="rounded-3xl glass-strong p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, category, or reference..."
              className="w-full h-11 rounded-xl bg-white/5 border border-white/10 pl-10 pr-3 text-sm outline-none focus:border-primary/60"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="h-11 rounded-xl bg-white/5 border border-white/10 px-3 text-sm outline-none focus:border-primary/60"
          >
            {["all", "Completed", "Pending", "Failed"].map((s) => (
              <option key={s} value={s} className="bg-[oklch(0.2_0.03_265)]">
                Status: {s === "all" ? "All" : s}
              </option>
            ))}
          </select>
          <div className="inline-flex rounded-xl glass p-1">
            {(["7d", "30d", "all"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs rounded-lg ${range === r ? "bg-white/10" : "text-muted-foreground hover:text-foreground"}`}
              >
                {r === "7d" ? "7 days" : r === "30d" ? "30 days" : "All time"}
              </button>
            ))}
          </div>
          <button className="inline-flex items-center gap-2 rounded-xl glass px-3 h-11 text-sm hover:bg-white/10">
            <Filter className="h-4 w-4" /> More
          </button>
        </div>
      </div>

      {/* List */}
      <div className="rounded-3xl glass-strong overflow-hidden">
        <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 text-xs uppercase tracking-wider text-muted-foreground border-b border-white/5">
          <div>Description</div>
          <div>Date</div>
          <div>Status</div>
          <div className="text-right">Amount</div>
        </div>
        <div className="divide-y divide-white/5">
          {filtered.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelected(t)}
              className="w-full text-left grid sm:grid-cols-[1fr_auto_auto_auto] gap-3 sm:gap-4 px-5 py-4 hover:bg-white/5 transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`grid h-10 w-10 place-items-center rounded-xl ${t.type === "credit" ? "bg-primary/15 text-primary" : "bg-white/5"}`}>
                  {t.type === "credit" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground">{t.category} · {t.method}</div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground sm:text-right self-center">{new Date(t.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</div>
              <div className="self-center">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${statusColor[t.status]}`}>{t.status}</span>
              </div>
              <div className={`self-center text-sm font-semibold sm:text-right ${t.type === "credit" ? "text-primary" : ""}`}>
                {t.type === "credit" ? "+" : "−"}{formatINR(t.amount)}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">No transactions match your filters.</div>
          )}
        </div>
      </div>

      {/* Details modal */}
      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-md p-4" onClick={() => setSelected(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong rounded-3xl p-6 max-w-md w-full"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Transaction details</div>
                <div className="mt-1 font-semibold">{selected.title}</div>
              </div>
              <button onClick={() => setSelected(null)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className={`mt-6 text-3xl font-semibold ${selected.type === "credit" ? "text-primary" : ""}`}>
              {selected.type === "credit" ? "+" : "−"}{formatINR(selected.amount)}
            </div>
            <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs ${statusColor[selected.status]}`}>{selected.status}</span>

            <div className="mt-6 space-y-2 text-sm">
              <Row k="Reference" v={selected.id} />
              <Row k="Category" v={selected.category} />
              <Row k="Method" v={selected.method} />
              <Row k="Date" v={new Date(selected.date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} />
            </div>

            <div className="mt-6 flex gap-2">
              <button className="flex-1 rounded-xl glass py-2 text-sm hover:bg-white/10">Report</button>
              <button className="flex-1 rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground py-2 text-sm">Download receipt</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg glass px-3 py-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
