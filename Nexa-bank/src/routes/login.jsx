import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { Eye, EyeOff, ShieldCheck, Lock, Mail, Fingerprint } from "lucide-react";
import { signIn } from "@/lib/auth";
import { NexaLogo } from "@/components/NexaLogo";
export const Route = createFileRoute("/login")({
    head: () => ({
        meta: [
            { title: "Sign in — Nexa Bank" },
            { name: "description", content: "Secure sign-in to your Nexa Bank account." },
        ],
    }),
    component: LoginPage,
});
function LoginPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("aarav.sharma@nexabank.com");
    const [password, setPassword] = useState("••••••••••");
    const [showPw, setShowPw] = useState(false);
    const [remember, setRemember] = useState(true);
    const [loading, setLoading] = useState(false);
    const handleSubmit = (e) => {
        e.preventDefault();
        setLoading(true);
        setTimeout(() => {
            signIn();
            navigate({ to: "/dashboard" });
        }, 900);
    };
    return (<div className="relative grid min-h-screen w-full overflow-hidden bg-[#0b0f14] text-white lg:grid-cols-2">
      {/* Left brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[#b8f36b] opacity-[0.09] blur-3xl"/>
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-[#4c78b8] opacity-[0.09] blur-3xl"/>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <NexaLogo size="lg" />
            <div className="ml-[60px] mt-1 text-xs text-muted-foreground">Private Banking</div>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }} className="space-y-6">
          <h1 className="text-5xl font-semibold tracking-tight leading-tight">
            Banking that <span className="text-[#b8f36b]">moves with you.</span>
          </h1>
          <p className="max-w-md text-muted-foreground text-lg leading-relaxed">
            Zero-fee transfers, intelligent insights, and 24/7 protection — all in a single, beautifully-crafted account.
          </p>

          <div className="max-w-md rounded-2xl border border-white/[0.09] bg-[#11171d]/75 p-5 backdrop-blur-xl">
            <div className="flex items-center gap-3 text-sm">
              <Fingerprint className="h-5 w-5 text-[#b8f36b]"/>
              <span className="text-muted-foreground">
                Protected by 256-bit encryption & biometric authentication.
              </span>
            </div>
          </div>
        </motion.div>

        <div className="text-xs text-muted-foreground">
          © 2026 Nexa Bank · RBI Licensed · Deposits insured up to ₹5,00,000
        </div>
      </div>

      {/* Right auth form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <NexaLogo size="md" />
          </div>

          <div className="rounded-3xl border border-white/[0.09] bg-[#11171d]/95 p-8 shadow-[0_30px_90px_-40px_rgba(0,0,0,0.9)]">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Sign in to continue to your account.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Email address</label>
                <div className="mt-1.5 relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-11 rounded-xl bg-white/[0.035] border border-white/[0.09] pl-10 pr-3 text-sm outline-none transition placeholder:text-white/30 focus:border-[#b8f36b]/60 focus:bg-white/[0.055] focus:ring-2 focus:ring-[#b8f36b]/10" placeholder="you@example.com" required/>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Password</label>
                <div className="mt-1.5 relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                  <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full h-11 rounded-xl bg-white/[0.035] border border-white/[0.09] pl-10 pr-10 text-sm outline-none transition placeholder:text-white/30 focus:border-[#b8f36b]/60 focus:bg-white/[0.055] focus:ring-2 focus:ring-[#b8f36b]/10" placeholder="Enter your password" required/>
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPw ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-white/5 accent-[#b8f36b]"/>
                  <span className="text-muted-foreground">Remember me</span>
                </label>
                <button type="button" className="text-[#b8f36b] hover:underline">
                  Forgot password?
                </button>
              </div>

              <button type="submit" disabled={loading} className="w-full h-11 rounded-xl bg-[#b8f36b] text-[#14200d] font-semibold shadow-[0_8px_30px_-12px_rgba(184,243,107,0.75)] transition hover:bg-[#c9ff83] disabled:opacity-70">
                {loading ? (<span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin"/>
                    Signing in...
                  </span>) : ("Sign in securely")}
              </button>
            </form>

            <div className="mt-6 flex items-center gap-3 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-[#b8f36b]"/>
              <span>Your session is end-to-end encrypted.</span>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            New to Nexa Bank? <span className="text-[#b8f36b] cursor-pointer hover:underline">Open an account</span>
          </p>
        </motion.div>
      </div>
    </div>);
}
