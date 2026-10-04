import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { ArrowLeftRight, ChevronDown, ShieldCheck, RefreshCw, CheckCircle2, Copy, Check, X, Receipt, Building2, Wallet, AlertTriangle, Clock, MessageSquare, User, } from "lucide-react";
import { beneficiaries, useBankStore, formatINR, formatINRDetailed, user } from "@/lib/mock-data";
import { transferMoney, ApiError } from "@/lib/api";
import { useIncidentBus } from "@/hooks/useIncidentBus";
export const Route = createFileRoute("/_authenticated/transfer")({
    head: () => ({ meta: [{ title: "Transfer Money — Nexa Bank" }] }),
    component: TransferPage,
});
function TransferPage() {
    const { accounts, deductBalance, recordTransaction } = useBankStore();
    const [beneficiary, setBeneficiary] = useState(beneficiaries[0].id);
    const [account, setAccount] = useState(beneficiaries[0].account);
    const [ifsc, setIfsc] = useState(beneficiaries[0].ifsc);
    const [amount, setAmount] = useState("0");
    const [remarks, setRemarks] = useState("");
    const [fromAcct, setFromAcct] = useState("savings");
    const [senderEmail, setSenderEmail] = useState(user?.email || "pranavjadhav1319@gmail.com");
    const [state, setState] = useState("idle");
    const [successData, setSuccessData] = useState(null);
    const [transferError, setTransferError] = useState(null);
    const [copied, setCopied] = useState(false);
    // Live incident bus — used to auto-transition recovery → retry-available
    const { incident, justResolved } = useIncidentBus();
    // Auto-enable retry when incident resolves
    useEffect(() => {
        if ((state === "recovery" || state === "failed") && justResolved) {
            setState("retry");
        }
    }, [justResolved, state]);
    // Also enable retry if incident clears while in recovery state
    useEffect(() => {
        if (state === "recovery" && !incident && !justResolved) {
            const t = setTimeout(() => setState("retry"), 1500);
            return () => clearTimeout(t);
        }
    }, [incident, justResolved, state]);
    const onBeneficiaryChange = (id) => {
        setBeneficiary(id);
        const b = beneficiaries.find((x) => x.id === id);
        if (b) {
            setAccount(b.account);
            setIfsc(b.ifsc);
        }
    };
    const copyTxId = (id) => {
        navigator.clipboard.writeText(id);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    const src = fromAcct === "savings" ? accounts.savings : accounts.current;
    const selectedBeneficiary = beneficiaries.find((b) => b.id === beneficiary);
    const submit = async (e) => {
        e.preventDefault();
        if (state === "processing")
            return;
        const numAmount = Number(amount);
        if (!numAmount || numAmount <= 0)
            return;
        if (numAmount > src.balance) {
            setTransferError({
                customerMessage: `Insufficient funds in your ${fromAcct} account. Available balance is ${formatINR(src.balance)}.`,
                incidentActive: false,
                etaMinutes: 0,
                transactionRef: `REF-${Date.now().toString().slice(-6)}`,
            });
            setState("failed");
            return;
        }
        setState("processing");
        setSuccessData(null);
        setTransferError(null);
        const method = selectedBeneficiary?.type || "IMPS";
        try {
            const result = await transferMoney({
                amount: numAmount,
                fromAccount: fromAcct,
                beneficiaryId: beneficiary,
                toAccount: account,
                remarks,
                method,
                userEmail: senderEmail,
            });
            // 1. Real account deduction in bank store
            const updatedAccounts = deductBalance(fromAcct, numAmount);
            // 2. Real transaction recorded in bank store
            recordTransaction({
                id: result.transactionId,
                title: `Transfer to ${selectedBeneficiary?.name || "Beneficiary"}`,
                category: "Transfer",
                date: new Date().toISOString().slice(0, 10),
                amount: numAmount,
                type: "debit",
                status: "Completed",
                method: result.method || method,
                toAccount: account,
                fromAccount: src.number,
            });
            // 3. Populate receipt for the Pop-up Modal
            setSuccessData({
                txId: result.transactionId,
                amount: numAmount,
                recipientName: selectedBeneficiary?.name || "Beneficiary",
                recipientAccount: account,
                recipientBank: selectedBeneficiary?.bank || "Bank",
                fromAccountType: fromAcct,
                fromAccountNumber: src.number,
                remainingBalance: updatedAccounts[fromAcct].balance,
                method: result.method || method,
                timestamp: result.timestamp || new Date().toISOString(),
                remarks: remarks || undefined,
            });
            setState("success");
        }
        catch (err) {
            const ref = `TR-${Date.now().toString().slice(-8)}`;
            if (err instanceof ApiError) {
                setTransferError({
                    customerMessage: err.customerMessage,
                    incidentActive: err.incidentActive,
                    etaMinutes: err.etaMinutes,
                    transactionRef: ref,
                });
                setState(err.incidentActive ? "recovery" : "failed");
            }
            else {
                // Network error (Express offline)
                setTransferError({
                    customerMessage: "We're having trouble reaching our servers. Your money has not been moved. Please try again shortly.",
                    incidentActive: false,
                    etaMinutes: 5,
                    transactionRef: ref,
                });
                setState("failed");
            }
        }
    };
    const reset = () => {
        setState("idle");
        setAmount("0");
        setRemarks("");
        setSuccessData(null);
        setTransferError(null);
    };
    return (<div className="space-y-6 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-sm text-muted-foreground">Payments</div>
        <h1 className="text-3xl font-semibold tracking-tight mt-1">Transfer money</h1>
        <p className="mt-1 text-sm text-muted-foreground">Send funds instantly via IMPS, NEFT or RTGS.</p>
      </motion.div>

      <motion.form initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} onSubmit={submit} className="rounded-3xl glass-strong p-6 sm:p-8 space-y-5 relative">
        {/* Customer Account Switcher (allows demoing multiple affected users) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-primary" /> Transferring As Customer
            </label>
            <span className="text-[10px] text-primary/80 font-mono">Select user to test affected count</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { name: "Pranav Jadhav", email: "pranavjadhav1319@gmail.com" },
              { name: "Aarav Sharma", email: "aarav.sharma@nexabank.com" },
              { name: "Priya Patel", email: "priya.patel@example.com" },
              { name: "Vikram Malhotra", email: "vikram.malhotra@corp.in" },
            ].map((u) => {
              const active = senderEmail === u.email;
              return (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => setSenderEmail(u.email)}
                  className={`text-left rounded-xl p-2.5 border transition ${
                    active
                      ? "border-primary/60 bg-primary/15 text-white shadow-sm"
                      : "border-white/10 glass hover:bg-white/5 text-muted-foreground"
                  }`}
                >
                  <div className="text-xs font-semibold truncate text-foreground">{u.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate font-mono">{u.email}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* From account */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">From account</label>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {["savings", "current"].map((k) => {
            const a = k === "savings" ? accounts.savings : accounts.current;
            const active = fromAcct === k;
            return (<button key={k} type="button" onClick={() => setFromAcct(k)} className={`text-left rounded-2xl border p-4 transition ${active ? "border-primary/50 bg-primary/10" : "border-white/10 glass hover:bg-white/5"}`}>
                  <div className="text-xs text-muted-foreground capitalize">{k} account</div>
                  <div className="text-xs mt-0.5 font-mono">{a.number}</div>
                  <div className="mt-2 text-sm font-semibold text-gradient-primary">{formatINR(a.balance)}</div>
                </button>);
        })}
          </div>
        </div>

        {/* Beneficiary */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Beneficiary</label>
          <div className="mt-2 relative">
            <select value={beneficiary} onChange={(e) => onBeneficiaryChange(e.target.value)} className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-3 pr-10 text-sm outline-none focus:border-primary/60 appearance-none">
              {beneficiaries.map((b) => (<option key={b.id} value={b.id} className="bg-[oklch(0.2_0.03_265)]">
                  {b.name} — {b.bank} ({b.account})
                </option>))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"/>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Account number" value={account} onChange={setAccount} placeholder="1234 5678 9012"/>
          <Field label="IFSC code" value={ifsc} onChange={setIfsc} placeholder="ABCD0001234"/>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Amount</label>
          <div className="mt-2 relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">₹</span>
            <input type="text" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} className="w-full h-14 rounded-xl bg-white/5 border border-white/10 pl-9 pr-3 text-2xl font-semibold outline-none focus:border-primary/60"/>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {[1000, 5000, 10000, 15000].map((v) => (<button key={v} type="button" onClick={() => setAmount((prev) => String((Number(prev) || 0) + v))} className="rounded-full px-3 py-1 text-xs glass hover:bg-white/10 transition-colors">
                +{formatINR(v)}
              </button>))}
            <button type="button" onClick={() => setAmount("0")} className="rounded-full px-3 py-1 text-xs text-muted-foreground glass hover:bg-white/10 transition-colors">
              Clear
            </button>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">Available balance in {fromAcct}: <span className="text-foreground font-semibold">{formatINR(src.balance)}</span></div>
        </div>

        <Field label="Remarks (optional)" value={remarks} onChange={setRemarks} placeholder="e.g. Rent, gift, invoice #421"/>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary"/>
          Transfers are protected by 256-bit encryption & multi-factor verification.
        </div>

        <button type="submit" disabled={state === "processing"} className="w-full h-12 rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground font-medium shadow-[var(--shadow-glow)] hover:brightness-110 transition disabled:opacity-70 inline-flex items-center justify-center gap-2">
          {state === "processing" ? (<>
              <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin"/>
              Processing transfer...
            </>) : (<>
              <ArrowLeftRight className="h-4 w-4"/> Transfer {amount && Number(amount) > 0 ? formatINR(Number(amount)) : ""}
            </>)}
        </button>
      </motion.form>

      <AnimatePresence>
        {/* Processing overlay */}
        {state === "processing" && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-md p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-strong rounded-3xl p-8 max-w-sm w-full text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
                <RefreshCw className="h-7 w-7 text-primary-foreground animate-spin"/>
              </div>
              <div className="mt-5 text-lg font-semibold">Processing your transfer</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Please don't close this window. Securing the transaction channel.
              </div>
              <div className="mt-6 flex items-center gap-2 justify-center text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary"/> End-to-end encrypted
              </div>
            </motion.div>
          </motion.div>)}

        {/* 🌟 SUCCESS POP-UP MODAL (Modern Glassmorphic Dialog) */}
        {state === "success" && successData && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-lg overflow-y-auto">
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="relative w-full max-w-lg rounded-3xl glass-strong border border-emerald-500/30 p-6 sm:p-8 shadow-2xl overflow-hidden my-auto">
              {/* Background ambient glow */}
              <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none"/>
              <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-primary/20 blur-3xl pointer-events-none"/>

              {/* Top Close Button */}
              <button onClick={reset} className="absolute top-5 right-5 h-8 w-8 rounded-full glass flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors" aria-label="Close modal">
                <X className="h-4 w-4"/>
              </button>

              {/* Animated Success Badge */}
              <div className="text-center">
                <div className="relative mx-auto inline-flex items-center justify-center">
                  <div className="absolute h-20 w-20 rounded-full bg-emerald-500/20 animate-ping opacity-50"/>
                  <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-[0_0_30px_rgba(16,185,129,0.4)]">
                    <CheckCircle2 className="h-9 w-9"/>
                  </div>
                </div>

                <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
                  Transfer Successful!
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Funds have been transferred and credited instantly.
                </p>

                {/* Big Amount */}
                <div className="mt-4 py-2">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium block">Amount Transferred</span>
                  <div className="text-4xl font-extrabold tracking-tight text-emerald-400 mt-0.5">
                    {formatINRDetailed(successData.amount)}
                  </div>
                </div>
              </div>

              {/* Receipt Breakdown Card */}
              <div className="mt-6 rounded-2xl glass p-4 space-y-3.5 border border-white/5 text-sm">
                <div className="flex items-center justify-between pb-2.5 border-b border-white/5">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-primary"/> Sent to
                  </span>
                  <div className="text-right">
                    <span className="font-semibold text-foreground">{successData.recipientName}</span>
                    <div className="text-xs text-muted-foreground">{successData.recipientBank} · {successData.recipientAccount}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between pb-2.5 border-b border-white/5">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5 text-primary"/> Paid from
                  </span>
                  <div className="text-right">
                    <span className="font-medium text-foreground capitalize">{successData.fromAccountType} Account</span>
                    <div className="text-xs text-muted-foreground font-mono">{successData.fromAccountNumber}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between pb-2.5 border-b border-white/5">
                  <span className="text-xs text-muted-foreground">Remaining Balance</span>
                  <span className="font-semibold text-emerald-400">
                    {formatINRDetailed(successData.remainingBalance)}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2.5 border-b border-white/5">
                  <span className="text-xs text-muted-foreground">Payment Mode</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-white/10 text-foreground">
                    {successData.method}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Transaction ID</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-foreground select-all">{successData.txId}</span>
                    <button onClick={() => copyTxId(successData.txId)} className="p-1 rounded-md glass hover:bg-white/10 text-muted-foreground hover:text-foreground transition" title="Copy transaction ID">
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400"/> : <Copy className="h-3.5 w-3.5"/>}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button onClick={reset} className="flex-1 h-12 rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground font-medium shadow-[var(--shadow-glow)] hover:brightness-110 transition flex items-center justify-center gap-2">
                  <ArrowLeftRight className="h-4 w-4"/> Make another transfer
                </button>
                <Link to="/transactions" className="h-12 px-5 rounded-xl glass hover:bg-white/10 transition flex items-center justify-center gap-2 text-sm font-medium text-foreground">
                  <Receipt className="h-4 w-4"/> View transactions
                </Link>
              </div>
            </motion.div>
          </motion.div>)}

        {/* ⚠️ RECOVERY / BLOCKED / RETRY POP-UP MODAL */}
        {(state === "recovery" || state === "retry" || state === "failed") && transferError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-lg overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={`relative w-full max-w-lg rounded-3xl glass-strong border p-6 sm:p-8 shadow-2xl overflow-hidden my-auto ${
                state === "retry"
                  ? "border-teal-500/40"
                  : state === "recovery"
                  ? "border-amber-500/40"
                  : "border-red-500/40"
              }`}
            >
              {/* Background ambient glow */}
              <div
                className={`absolute -top-24 -right-24 h-48 w-48 rounded-full blur-3xl pointer-events-none ${
                  state === "retry"
                    ? "bg-teal-500/20"
                    : state === "recovery"
                    ? "bg-amber-500/20"
                    : "bg-red-500/20"
                }`}
              />

              {/* Top Close Button */}
              <button
                onClick={reset}
                className="absolute top-5 right-5 h-8 w-8 rounded-full glass flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Status Badge & Icon */}
              <div className="text-center">
                <div className="relative mx-auto inline-flex items-center justify-center">
                  <div
                    className={`relative grid h-16 w-16 place-items-center rounded-2xl text-white shadow-lg ${
                      state === "retry"
                        ? "bg-gradient-to-tr from-teal-500 to-emerald-400 shadow-teal-500/30"
                        : state === "recovery"
                        ? "bg-gradient-to-tr from-amber-500 to-orange-400 shadow-amber-500/30"
                        : "bg-gradient-to-tr from-red-500 to-pink-500 shadow-red-500/30"
                    }`}
                  >
                    {state === "retry" ? (
                      <CheckCircle2 className="h-9 w-9" />
                    ) : (
                      <AlertTriangle className="h-9 w-9" />
                    )}
                  </div>
                </div>

                <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
                  {state === "retry"
                    ? "Systems Restored — Ready to Retry"
                    : state === "recovery"
                    ? "Transaction Paused — Protection Active"
                    : "Transfer Temporarily Unavailable"}
                </h2>

                <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                  {state === "retry"
                    ? "The temporary service interruption has been resolved. You can now complete your transfer safely."
                    : transferError.customerMessage ||
                      "We are experiencing a temporary issue. Your account has not been debited. Please try again shortly."}
                </p>
              </div>

              {/* Guarantee Banner */}
              <div className="mt-5 rounded-2xl glass p-3.5 border border-emerald-500/20 bg-emerald-500/5 flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                <div className="text-xs text-emerald-200">
                  <span className="font-semibold text-emerald-300">Funds Protected:</span> Your account balance was <strong className="underline decoration-emerald-400">NOT debited</strong>.
                </div>
              </div>

              {/* Details breakdown */}
              <div className="mt-4 rounded-2xl glass p-4 space-y-2.5 border border-white/5 text-xs text-muted-foreground">
                <div className="flex justify-between items-center">
                  <span>Reference ID</span>
                  <span className="font-mono text-foreground font-medium select-all">{transferError.transactionRef}</span>
                </div>
                {state === "recovery" && transferError.etaMinutes && (
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-amber-400" /> Estimated Recovery
                    </span>
                    <span className="font-medium text-amber-300">~{transferError.etaMinutes} minutes</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span>Attempted Amount</span>
                  <span className="font-semibold text-foreground">{formatINR(Number(amount) || 0)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                {state === "retry" ? (
                  <button
                    onClick={submit}
                    className="flex-1 h-12 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-medium shadow-lg hover:brightness-110 transition flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" /> Retry Transfer Now
                  </button>
                ) : (
                  <>
                    <Link
                      to="/support"
                      className="flex-1 h-12 rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground font-medium shadow-[var(--shadow-glow)] hover:brightness-110 transition flex items-center justify-center gap-2 text-sm"
                    >
                      <MessageSquare className="h-4 w-4" /> Ask Shield Support
                    </Link>
                    <button
                      onClick={reset}
                      className="h-12 px-5 rounded-xl glass hover:bg-white/10 transition flex items-center justify-center text-sm font-medium text-foreground"
                    >
                      Close
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>);
}
function Field({ label, value, onChange, placeholder }) {
    return (<div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-2 w-full h-11 rounded-xl bg-white/5 border border-white/10 px-3 text-sm outline-none focus:border-primary/60"/>
    </div>);
}
