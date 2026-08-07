import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  ChevronDown,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { beneficiaries, accounts, formatINR } from "@/lib/mock-data";
import { transferMoney, ApiError } from "@/lib/api";
import { useIncidentBus } from "@/hooks/useIncidentBus";

export const Route = createFileRoute("/_authenticated/transfer")({
  head: () => ({ meta: [{ title: "Transfer Money — Nexa Bank" }] }),
  component: TransferPage,
});

type State = "idle" | "processing" | "success" | "failed" | "recovery" | "retry";

interface TransferError {
  customerMessage: string;
  incidentActive: boolean;
  etaMinutes: number;
  transactionRef: string;
}

function TransferPage() {
  const [beneficiary, setBeneficiary] = useState(beneficiaries[0].id);
  const [account, setAccount] = useState(beneficiaries[0].account);
  const [ifsc, setIfsc] = useState(beneficiaries[0].ifsc);
  const [amount, setAmount] = useState("15000");
  const [remarks, setRemarks] = useState("");
  const [fromAcct, setFromAcct] = useState<"savings" | "current">("savings");
  const [state, setState] = useState<State>("idle");
  const [successData, setSuccessData] = useState<{ txId: string; amount: number } | null>(null);
  const [transferError, setTransferError] = useState<TransferError | null>(null);

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
      // Incident cleared without triggering justResolved (e.g., manual clear) — small delay then enable retry
      const t = setTimeout(() => setState("retry"), 1500);
      return () => clearTimeout(t);
    }
  }, [incident, justResolved, state]);

  const onBeneficiaryChange = (id: string) => {
    setBeneficiary(id);
    const b = beneficiaries.find((x) => x.id === id);
    if (b) {
      setAccount(b.account);
      setIfsc(b.ifsc);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "processing") return;

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) return;

    setState("processing");
    setSuccessData(null);
    setTransferError(null);

    try {
      const result = await transferMoney({
        amount: numAmount,
        fromAccount: fromAcct,
        beneficiaryId: beneficiary,
        toAccount: account,
        remarks,
        method: beneficiaries.find((b) => b.id === beneficiary)?.type || "IMPS",
      });

      setSuccessData({ txId: result.transactionId, amount: result.amount });
      setState("success");
    } catch (err) {
      const ref = `TR-${Date.now().toString().slice(-8)}`;

      if (err instanceof ApiError) {
        setTransferError({
          customerMessage: err.customerMessage,
          incidentActive: err.incidentActive,
          etaMinutes: err.etaMinutes,
          transactionRef: ref,
        });
        setState(err.incidentActive ? "recovery" : "failed");
      } else {
        // Network error (Express offline)
        setTransferError({
          customerMessage:
            "We're having trouble reaching our servers. Your money has not been moved. Please try again shortly.",
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
    setSuccessData(null);
    setTransferError(null);
  };

  const src = fromAcct === "savings" ? accounts.savings : accounts.current;
  const selectedBeneficiary = beneficiaries.find((b) => b.id === beneficiary);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-sm text-muted-foreground">Payments</div>
        <h1 className="text-3xl font-semibold tracking-tight mt-1">Transfer money</h1>
        <p className="mt-1 text-sm text-muted-foreground">Send funds instantly via IMPS, NEFT or RTGS.</p>
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        onSubmit={submit}
        className="rounded-3xl glass-strong p-6 sm:p-8 space-y-5"
      >
        {/* From account */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">From account</label>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {(["savings", "current"] as const).map((k) => {
              const a = k === "savings" ? accounts.savings : accounts.current;
              const active = fromAcct === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFromAcct(k)}
                  className={`text-left rounded-2xl border p-4 transition ${active ? "border-primary/50 bg-primary/10" : "border-white/10 glass hover:bg-white/5"}`}
                >
                  <div className="text-xs text-muted-foreground capitalize">{k}</div>
                  <div className="text-xs mt-0.5">{a.number}</div>
                  <div className="mt-2 text-sm font-semibold">{formatINR(a.balance)}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Beneficiary */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Beneficiary</label>
          <div className="mt-2 relative">
            <select
              value={beneficiary}
              onChange={(e) => onBeneficiaryChange(e.target.value)}
              className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-3 pr-10 text-sm outline-none focus:border-primary/60 appearance-none"
            >
              {beneficiaries.map((b) => (
                <option key={b.id} value={b.id} className="bg-[oklch(0.2_0.03_265)]">
                  {b.name} — {b.bank} ({b.account})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Account number" value={account} onChange={setAccount} placeholder="1234 5678 9012" />
          <Field label="IFSC code" value={ifsc} onChange={setIfsc} placeholder="ABCD0001234" />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Amount</label>
          <div className="mt-2 relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">₹</span>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
              className="w-full h-14 rounded-xl bg-white/5 border border-white/10 pl-9 pr-3 text-2xl font-semibold outline-none focus:border-primary/60"
            />
          </div>
          <div className="mt-2 flex gap-2">
            {[1000, 5000, 10000, 25000].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(String(v))}
                className="rounded-full px-3 py-1 text-xs glass hover:bg-white/10"
              >
                +{formatINR(v)}
              </button>
            ))}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">Available in {fromAcct}: {formatINR(src.balance)}</div>
        </div>

        <Field label="Remarks (optional)" value={remarks} onChange={setRemarks} placeholder="e.g. Rent, gift, invoice #421" />

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Transfers are protected by device biometrics and multi-factor verification.
        </div>

        <button
          type="submit"
          disabled={state === "processing"}
          className="w-full h-12 rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground font-medium shadow-[var(--shadow-glow)] hover:brightness-110 transition disabled:opacity-70 inline-flex items-center justify-center gap-2"
        >
          {state === "processing" ? (
            <>
              <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
              Processing transfer...
            </>
          ) : (
            <>
              <ArrowLeftRight className="h-4 w-4" /> Transfer {amount && formatINR(Number(amount))}
            </>
          )}
        </button>
      </motion.form>

      <AnimatePresence>
        {/* Processing overlay */}
        {state === "processing" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass-strong rounded-3xl p-8 max-w-sm w-full text-center"
            >
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
                <RefreshCw className="h-7 w-7 text-primary-foreground animate-spin" />
              </div>
              <div className="mt-5 text-lg font-semibold">Processing your transfer</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Please don't close this window. This may take a few moments.
              </div>
              <div className="mt-6 flex items-center gap-2 justify-center text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Secure transaction
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Success state */}
        {state === "success" && successData && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-3xl glass-strong p-6 border border-primary/30"
          >
            <div className="flex gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary shrink-0">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">Transfer successful</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatINR(successData.amount)} has been sent to {selectedBeneficiary?.name}. The amount will reflect in their account within minutes.
                </p>
                <div className="mt-3 text-xs text-muted-foreground">
                  Transaction ID: <span className="text-foreground font-mono">{successData.txId}</span>
                </div>
                <div className="mt-4">
                  <button
                    onClick={reset}
                    className="rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground px-4 py-2 text-sm font-medium hover:brightness-110"
                  >
                    New transfer
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Recovery state — incident active, automated recovery running */}
        {state === "recovery" && transferError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-3xl glass-strong p-6 border border-[oklch(0.8_0.16_80)_/_30%]"
          >
            <div className="flex gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[oklch(0.8_0.16_80)_/_15%] text-[oklch(0.85_0.16_80)] shrink-0">
                <RefreshCw className="h-6 w-6 animate-spin" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">Automated recovery in progress</div>
                <p className="mt-1 text-sm text-muted-foreground">{transferError.customerMessage}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Estimated recovery: ~{transferError.etaMinutes} minutes · Ref: {transferError.transactionRef}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  This page will automatically update when services are restored. You do not need to refresh.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Retry state — incident resolved, prompt user to retry */}
        {state === "retry" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-3xl glass-strong p-6 border border-primary/30"
          >
            <div className="flex gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary shrink-0">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">Service restored — you can retry now</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Our systems have fully recovered. Your previous transfer was not charged. Please resubmit to complete your transaction.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={reset}
                    className="rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground px-4 py-2 text-sm font-medium hover:brightness-110"
                  >
                    Retry transfer
                  </button>
                  <button
                    onClick={reset}
                    className="rounded-xl glass px-4 py-2 text-sm font-medium hover:bg-white/10"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Failed state — no incident, permanent failure */}
        {state === "failed" && transferError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-3xl glass-strong p-6 border border-[oklch(0.63_0.22_25)_/_30%]"
          >
            <div className="flex gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[oklch(0.63_0.22_25)_/_15%] text-[oklch(0.75_0.2_25)] shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">We couldn't complete your transfer right now</div>
                <p className="mt-1 text-sm text-muted-foreground">{transferError.customerMessage}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={reset}
                    className="rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground px-4 py-2 text-sm font-medium hover:brightness-110"
                  >
                    Try again
                  </button>
                  <button
                    onClick={reset}
                    className="rounded-xl glass px-4 py-2 text-sm font-medium hover:bg-white/10"
                  >
                    Cancel
                  </button>
                </div>
                <div className="mt-4 text-xs text-muted-foreground">
                  Reference ID: {transferError.transactionRef} · If the issue persists, our support team is available 24/7.
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full h-11 rounded-xl bg-white/5 border border-white/10 px-3 text-sm outline-none focus:border-primary/60"
      />
    </div>
  );
}
