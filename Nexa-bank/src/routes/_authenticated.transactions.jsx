import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Search, Download, ArrowUpRight, ArrowDownLeft, X, FileText, CheckCircle2 } from "lucide-react";
import { useBankStore, formatINR, formatINRDetailed, user } from "@/lib/mock-data";
export const Route = createFileRoute("/_authenticated/transactions")({
    head: () => ({ meta: [{ title: "Transactions — Nexa Bank" }] }),
    component: TxnPage,
});
const statusColor = {
    Completed: "bg-primary/15 text-primary",
    Pending: "bg-[oklch(0.8_0.16_80)_/_15%] text-[oklch(0.85_0.16_80)]",
    Failed: "bg-destructive/15 text-destructive",
};
// Relative date formatter
function formatTxnDate(isoStr) {
    const d = new Date(isoStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
        return `Today, ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}`;
    }
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
        return `Yesterday, ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}`;
    }
    return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
}
function TxnPage() {
    const { transactions } = useBankStore();
    const [q, setQ] = useState("");
    const [status, setStatus] = useState("all");
    const [category, setCategory] = useState("all");
    const [range, setRange] = useState("30d");
    const [selected, setSelected] = useState(null);
    const [reported, setReported] = useState(null);
    // Extract unique categories dynamically from real transaction history
    const categories = useMemo(() => {
        const set = new Set(transactions.map((t) => t.category));
        return Array.from(set);
    }, [transactions]);
    const filtered = useMemo(() => {
        return transactions.filter((t) => {
            if (status !== "all" && t.status !== status)
                return false;
            if (category !== "all" && t.category !== category)
                return false;
            if (q) {
                const query = q.toLowerCase();
                const searchCorpus = `${t.title} ${t.category} ${t.id} ${t.method}`.toLowerCase();
                if (!searchCorpus.includes(query))
                    return false;
            }
            if (range !== "all") {
                const days = range === "7d" ? 7 : 30;
                const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
                const txnTime = new Date(t.date).getTime();
                if (txnTime < cutoff)
                    return false;
            }
            return true;
        });
    }, [transactions, q, status, category, range]);
    // Real CSV Statement Downloader
    const downloadStatement = () => {
        const headers = ["Date", "Transaction ID", "Description", "Category", "Payment Method", "Type", "Amount (INR)", "Status"];
        const rows = filtered.map((t) => [
            new Date(t.date).toLocaleString("en-IN"),
            t.id,
            `"${t.title.replace(/"/g, '""')}"`,
            t.category,
            t.method,
            t.type.toUpperCase(),
            t.amount,
            t.status,
        ]);
        const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Nexa_Bank_Statement_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };
    // Real Receipt Downloader
    const downloadReceipt = (t) => {
        const text = `================================================
           NEXA BANK PRIVATE LIMITED
           TRANSACTION RECEIPT
================================================
Transaction ID  : ${t.id}
Date & Time     : ${new Date(t.date).toLocaleString("en-IN")}
Account Holder  : ${user.name} (${user.email})
Description     : ${t.title}
Category        : ${t.category}
Payment Method  : ${t.method}
Type            : ${t.type.toUpperCase()}
Amount          : INR ${t.amount.toLocaleString("en-IN")}
Status          : ${t.status.toUpperCase()}
================================================
Protected by 256-bit Encryption · RBI Licensed
================================================`;
        const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Nexa_Receipt_${t.id}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };
    const handleReport = (t) => {
        setReported(t.id);
        setTimeout(() => setReported(null), 3500);
    };
    return (<div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">History</div>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">Transactions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track, search and export your complete transaction activity.</p>
        </div>
        <button onClick={downloadStatement} className="inline-flex items-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground px-4 py-2.5 text-sm font-medium shadow-[var(--shadow-glow)] hover:brightness-110 transition">
          <Download className="h-4 w-4"/> Download statement (CSV)
        </button>
      </motion.div>

      {/* Filters */}
      <div className="rounded-3xl glass-strong p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by description, category, ID..." className="w-full h-11 rounded-xl bg-white/5 border border-white/10 pl-10 pr-3 text-sm outline-none focus:border-primary/60"/>
          </div>

          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 rounded-xl bg-white/5 border border-white/10 px-3 text-sm outline-none focus:border-primary/60">
            {["all", "Completed", "Pending", "Failed"].map((s) => (<option key={s} value={s} className="bg-[oklch(0.2_0.03_265)]">
                Status: {s === "all" ? "All" : s}
              </option>))}
          </select>

          <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-11 rounded-xl bg-white/5 border border-white/10 px-3 text-sm outline-none focus:border-primary/60">
            <option value="all" className="bg-[oklch(0.2_0.03_265)]">Category: All</option>
            {categories.map((c) => (<option key={c} value={c} className="bg-[oklch(0.2_0.03_265)]">
                Category: {c}
              </option>))}
          </select>

          <div className="inline-flex rounded-xl glass p-1">
            {["7d", "30d", "all"].map((r) => (<button key={r} onClick={() => setRange(r)} className={`px-3 py-1.5 text-xs rounded-lg transition ${range === r ? "bg-white/10 text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}>
                {r === "7d" ? "Last 7 days" : r === "30d" ? "Last 30 days" : "All time"}
              </button>))}
          </div>
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
          {filtered.map((t) => (<button key={t.id} onClick={() => setSelected(t)} className="w-full text-left grid sm:grid-cols-[1fr_auto_auto_auto] gap-3 sm:gap-4 px-5 py-4 hover:bg-white/5 transition">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`grid h-10 w-10 place-items-center rounded-xl shrink-0 ${t.type === "credit" ? "bg-primary/15 text-primary" : "bg-white/5"}`}>
                  {t.type === "credit" ? <ArrowDownLeft className="h-4 w-4"/> : <ArrowUpRight className="h-4 w-4"/>}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground">{t.category} · {t.method}</div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground sm:text-right self-center">
                {formatTxnDate(t.date)}
              </div>
              <div className="self-center">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${statusColor[t.status]}`}>{t.status}</span>
              </div>
              <div className={`self-center text-sm font-semibold sm:text-right ${t.type === "credit" ? "text-emerald-400" : ""}`}>
                {t.type === "credit" ? "+" : "−"}{formatINR(t.amount)}
              </div>
            </button>))}
          {filtered.length === 0 && (<div className="p-12 text-center text-sm text-muted-foreground">
              No transactions match your current filters.
            </div>)}
        </div>
      </div>

      {/* Details modal */}
      {selected && (<div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-md p-4" onClick={() => setSelected(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={(e) => e.stopPropagation()} className="glass-strong rounded-3xl p-6 max-w-md w-full relative">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Transaction details</div>
                <div className="mt-1 font-semibold text-lg">{selected.title}</div>
              </div>
              <button onClick={() => setSelected(null)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10">
                <X className="h-4 w-4"/>
              </button>
            </div>

            <div className={`mt-5 text-3xl font-bold ${selected.type === "credit" ? "text-emerald-400" : "text-foreground"}`}>
              {selected.type === "credit" ? "+" : "−"}{formatINRDetailed(selected.amount)}
            </div>
            <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs ${statusColor[selected.status]}`}>{selected.status}</span>

            <div className="mt-5 space-y-2 text-sm">
              <Row k="Reference ID" v={selected.id} mono/>
              <Row k="Category" v={selected.category}/>
              <Row k="Payment Mode" v={selected.method}/>
              <Row k="Timestamp" v={new Date(selected.date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}/>
            </div>

            {reported === selected.id && (<div className="mt-4 p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-2 text-xs text-primary">
                <CheckCircle2 className="h-4 w-4 shrink-0"/>
                Report logged for transaction {selected.id}. Support ticket generated.
              </div>)}

            <div className="mt-6 flex gap-2">
              <button onClick={() => handleReport(selected)} className="flex-1 rounded-xl glass py-2.5 text-sm hover:bg-white/10 transition">
                Report issue
              </button>
              <button onClick={() => downloadReceipt(selected)} className="flex-1 rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground py-2.5 text-sm font-medium shadow-[var(--shadow-glow)] hover:brightness-110 transition flex items-center justify-center gap-1.5">
                <FileText className="h-4 w-4"/> Download receipt
              </button>
            </div>
          </motion.div>
        </div>)}
    </div>);
}
function Row({ k, v, mono }) {
    return (<div className="flex items-center justify-between rounded-xl glass px-3.5 py-2.5">
      <span className="text-xs text-muted-foreground">{k}</span>
      <span className={`text-xs font-medium text-foreground ${mono ? "font-mono" : ""}`}>{v}</span>
    </div>);
}
