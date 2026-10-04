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
    Completed: "border-[#b8f36b]/20 bg-[#b8f36b]/[0.08] text-[#c4f889]",
    Pending: "border-amber-300/20 bg-amber-300/[0.08] text-amber-200",
    Failed: "border-rose-300/20 bg-rose-300/[0.08] text-rose-200",
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
    const totalIncoming = transactions.filter((t) => t.type === "credit").reduce((sum, t) => sum + t.amount, 0);
    const totalOutgoing = transactions.filter((t) => t.type !== "credit").reduce((sum, t) => sum + t.amount, 0);
    const completedCount = transactions.filter((t) => t.status === "Completed").length;
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
    return (
      <div className="w-full min-w-0 space-y-6 sm:space-y-7">
        <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-medium tracking-[0.16em] text-[#b8f36b]">HISTORY</div>
            <h1 className="mt-2 text-3xl font-medium tracking-[-0.05em] sm:text-4xl">Transactions</h1>
            <p className="mt-2 text-sm text-white/45">Track, search and export your complete account activity.</p>
          </div>
          <button onClick={downloadStatement} className="inline-flex items-center gap-2 rounded-xl bg-[#b8f36b] px-4 py-3 text-sm font-semibold text-[#14200d] shadow-[0_8px_30px_-12px_rgba(184,243,107,0.65)] transition hover:bg-[#c9ff83]">
            <Download className="h-4 w-4" /> Download statement
          </button>
        </motion.header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Transaction summary">
          <SummaryCard label="Money in" amount={totalIncoming} detail="Credits across all activity" accent="lime" />
          <SummaryCard label="Money out" amount={totalOutgoing} detail="Debits across all activity" accent="neutral" />
          <SummaryCard label="Transactions" value={transactions.length} detail="Across your accounts" accent="neutral" />
          <SummaryCard label="Completed" value={completedCount} detail="Successfully processed" accent="lime" />
        </section>

        <section className="rounded-[24px] border border-white/[0.08] bg-[#11171d]/90 p-4 sm:p-5" aria-label="Filter transactions">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white/85">Activity</h2>
              <p className="mt-1 text-xs text-white/40">Showing {filtered.length} of {transactions.length} transactions</p>
            </div>
            {(q || status !== "all" || category !== "all" || range !== "30d") && (
              <button onClick={() => { setQ(""); setStatus("all"); setCategory("all"); setRange("30d"); }} className="text-xs text-[#c4f889] transition hover:text-[#e2ffc1]">Reset filters</button>
            )}
          </div>
          <div className="grid gap-2.5 xl:grid-cols-[minmax(240px,1fr)_auto_auto_auto]">
            <div className="relative min-w-0">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search description, category, ID or method" className="h-11 w-full rounded-xl border border-white/[0.09] bg-white/[0.025] pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#b8f36b]/50 focus:ring-2 focus:ring-[#b8f36b]/10" />
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status" className="h-11 rounded-xl border border-white/[0.09] bg-[#11171d] px-3 text-sm text-white/75 outline-none focus:border-[#b8f36b]/50">
              {["all", "Completed", "Pending", "Failed"].map((item) => <option key={item} value={item} className="bg-[#11171d]">Status: {item === "all" ? "All" : item}</option>)}
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category" className="h-11 rounded-xl border border-white/[0.09] bg-[#11171d] px-3 text-sm text-white/75 outline-none focus:border-[#b8f36b]/50">
              <option value="all" className="bg-[#11171d]">Category: All</option>
              {categories.map((item) => <option key={item} value={item} className="bg-[#11171d]">Category: {item}</option>)}
            </select>
            <div className="inline-flex min-w-max rounded-xl border border-white/[0.08] bg-white/[0.025] p-1">
              {["7d", "30d", "all"].map((item) => (
                <button key={item} type="button" onClick={() => setRange(item)} className={`rounded-lg px-3 py-1.5 text-xs transition ${range === item ? "bg-[#b8f36b]/[0.12] font-medium text-[#c4f889]" : "text-white/45 hover:text-white/80"}`}>
                  {item === "7d" ? "7 days" : item === "30d" ? "30 days" : "All time"}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#11171d]/90" aria-label="Transaction list">
          <div className="hidden border-b border-white/[0.07] px-5 py-3.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white/35 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(130px,0.62fr)_minmax(120px,0.6fr)_auto_minmax(115px,0.52fr)] lg:gap-4 lg:px-7">
            <span>Description</span><span>Category & method</span><span>Date</span><span>Status</span><span className="text-right">Amount</span>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {filtered.map((transaction) => {
              const credit = transaction.type === "credit";
              const Icon = credit ? ArrowDownLeft : ArrowUpRight;
              return (
                <button
                  key={transaction.id}
                  onClick={() => setSelected(transaction)}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 text-left transition hover:bg-white/[0.025] sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(130px,0.62fr)_minmax(120px,0.6fr)_auto_minmax(115px,0.52fr)] lg:gap-4 lg:px-7"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${credit ? "bg-[#b8f36b]/[0.09] text-[#b8f36b]" : "bg-white/[0.045] text-white/55"}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-white/90">{transaction.title}</span>
                      <span className="mt-1 block truncate text-xs text-white/40 lg:hidden">{transaction.category} · {transaction.method} · {formatTxnDate(transaction.date)}</span>
                      <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] lg:hidden ${statusColor[transaction.status]}`}>{transaction.status}</span>
                    </span>
                  </span>
                  <span className="hidden truncate text-xs text-white/50 lg:block">{transaction.category} <span className="text-white/25">·</span> {transaction.method}</span>
                  <span className="hidden text-xs text-white/50 lg:block">{formatTxnDate(transaction.date)}</span>
                  <span className="hidden lg:inline-flex">
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${statusColor[transaction.status]}`}>{transaction.status}</span>
                  </span>
                  <span className={`justify-self-end whitespace-nowrap text-sm font-semibold ${credit ? "text-[#c4f889]" : "text-white/80"}`}>
                    {credit ? "+" : "−"}{formatINR(transaction.amount)}
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="grid justify-items-center px-6 py-16 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.025] text-white/35"><FileText className="h-5 w-5" /></span>
                <p className="mt-4 text-sm font-medium text-white/75">No transactions found</p>
                <p className="mt-1 text-xs text-white/40">Try changing your search or filters.</p>
              </div>
            )}
          </div>
        </section>

        {selected && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-md" onClick={() => setSelected(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} onClick={(e) => e.stopPropagation()} className="relative w-full max-w-lg rounded-[24px] border border-white/[0.09] bg-[#11171d] p-5 shadow-2xl sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-medium tracking-[0.14em] text-white/40">TRANSACTION DETAILS</div>
                  <div className="mt-2 text-lg font-semibold text-white/90">{selected.title}</div>
                </div>
                <button onClick={() => setSelected(null)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white/45 transition hover:bg-white/[0.06] hover:text-white" aria-label="Close details"><X className="h-4 w-4" /></button>
              </div>
              <div className={`mt-6 text-3xl font-semibold tracking-tight ${selected.type === "credit" ? "text-[#c4f889]" : "text-white"}`}>
                {selected.type === "credit" ? "+" : "−"}{formatINRDetailed(selected.amount)}
              </div>
              <span className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium ${statusColor[selected.status]}`}>{selected.status}</span>
              <div className="mt-5 space-y-2">
                <Row k="Reference ID" v={selected.id} mono />
                <Row k="Category" v={selected.category} />
                <Row k="Payment mode" v={selected.method} />
                <Row k="Date and time" v={new Date(selected.date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} />
              </div>
              {reported === selected.id && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#b8f36b]/15 bg-[#b8f36b]/[0.06] p-3 text-xs text-[#c4f889]">
                  <CheckCircle2 className="h-4 w-4 shrink-0" /> Report logged for transaction {selected.id}. Support ticket generated.
                </div>
              )}
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                <button onClick={() => handleReport(selected)} className="rounded-xl border border-white/[0.09] bg-white/[0.025] py-3 text-sm text-white/70 transition hover:bg-white/[0.06]">Report issue</button>
                <button onClick={() => downloadReceipt(selected)} className="flex items-center justify-center gap-2 rounded-xl bg-[#b8f36b] py-3 text-sm font-semibold text-[#14200d] transition hover:bg-[#c9ff83]"><FileText className="h-4 w-4" /> Download receipt</button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    );
}
function SummaryCard({ label, amount, value, detail, accent = "neutral" }) {
    const highlighted = accent === "lime";
    return (
      <article className="rounded-[20px] border border-white/[0.08] bg-[#11171d]/90 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-white/45">{label}</p>
          <span className={`h-2 w-2 rounded-full ${highlighted ? "bg-[#b8f36b]" : "bg-white/25"}`} />
        </div>
        <p className="mt-3 text-2xl font-medium tracking-[-0.045em] text-white/90">{amount !== undefined ? formatINR(amount) : value}</p>
        <p className="mt-1 text-[11px] text-white/35">{detail}</p>
      </article>
    );
}
function Row({ k, v, mono }) {
    return (<div className="flex items-center justify-between rounded-xl glass px-3.5 py-2.5">
      <span className="text-xs text-muted-foreground">{k}</span>
      <span className={`text-xs font-medium text-foreground ${mono ? "font-mono" : ""}`}>{v}</span>
    </div>);
}
