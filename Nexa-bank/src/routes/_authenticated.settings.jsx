import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { Bell, Globe, Lock, Palette, ShieldCheck, LogOut, EyeOff, Fingerprint } from "lucide-react";
import { signOut } from "@/lib/auth";
export const Route = createFileRoute("/_authenticated/settings")({
    head: () => ({ meta: [{ title: "Settings — Nexa Bank" }] }),
    component: SettingsPage,
});
function SettingsPage() {
    const navigate = useNavigate();
    const [theme, setTheme] = useState("dark");
    const [language, setLanguage] = useState("English (India)");
    const handleLogout = () => { signOut(); navigate({ to: "/login" }); };
    return (<div className="w-full min-w-0 space-y-7 sm:space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-[11px] font-medium tracking-[0.16em] text-[#b8f36b]">YOUR ACCOUNT</div>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.05em] sm:text-4xl">Settings</h1>
        <p className="mt-2 text-sm text-white/45">Make Nexa work the way you do.</p>
      </motion.div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section icon={Palette} title="Appearance">
          <div className="mb-2 text-xs text-white/45">Theme</div>
          <div className="inline-flex rounded-xl border border-white/[0.08] bg-[#0b0f14] p-1">
            {["dark", "system", "light"].map((t) => (<button key={t} onClick={() => setTheme(t)} className={`rounded-lg px-3 py-1.5 text-xs capitalize transition ${theme === t ? "bg-[#b8f36b]/[0.12] text-[#c4f889]" : "text-white/45 hover:text-white/80"}`}>
                {t}
              </button>))}
          </div>
          <div className="mt-3 text-xs text-white/40">
            Nexa Bank is optimized for dark mode. Light mode preview coming soon.
          </div>
        </Section>

        <Section icon={Bell} title="Notifications">
          <Toggle label="Transaction alerts" desc="Real-time push for debits & credits" defaultOn/>
          <Toggle label="Bill reminders" desc="3-day reminders before due date" defaultOn/>
          <Toggle label="Promotional offers" desc="Exclusive deals & rewards"/>
          <Toggle label="Security alerts" desc="Sign-ins & security events" defaultOn/>
        </Section>

        <Section icon={Globe} title="Language & region">
          <div className="mb-2 text-xs text-white/45">Language</div>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0b0f14] px-3 text-sm text-white/80 outline-none focus:border-[#b8f36b]/40">
            {["English (India)", "हिंदी", "தமிழ்", "മലയാളം", "ಕನ್ನಡ"].map((l) => (<option key={l} value={l} className="bg-[oklch(0.2_0.03_265)]">{l}</option>))}
          </select>
        </Section>

        <Section icon={EyeOff} title="Privacy">
          <Toggle label="Hide balances by default" desc="Balances stay hidden until you tap to reveal"/>
          <Toggle label="Analytics improvements" desc="Help improve our services with anonymous data" defaultOn/>
          <Toggle label="Personalized recommendations" desc="Tailored insights based on your activity" defaultOn/>
        </Section>

        <Section icon={Lock} title="Security">
          <Toggle label="Two-factor authentication" desc="OTP required on new devices" defaultOn/>
          <Toggle label="Biometric sign-in" desc="Face ID or fingerprint on trusted devices" defaultOn/>
          <div className="pt-2">
            <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] py-2.5 text-sm text-white/70 transition hover:border-[#b8f36b]/20 hover:text-[#c4f889]">
              <Fingerprint className="h-4 w-4"/> Change transaction PIN
            </button>
          </div>
        </Section>

        <Section icon={ShieldCheck} title="Session">
          <div className="text-sm text-muted-foreground">
            You are signed in on 3 devices. Sign out from the current device below or manage all sessions from Profile.
          </div>
          <button onClick={handleLogout} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] py-2.5 text-sm font-medium text-rose-200 transition hover:bg-rose-400/[0.12]">
            <LogOut className="h-4 w-4"/> Sign out
          </button>
        </Section>
      </div>
    </div>);
}
function Section({ icon: Icon, title, children }) {
    return (<section className="space-y-4 rounded-[24px] border border-white/[0.08] bg-[#11171d]/90 p-5 sm:p-6">
      <div className="flex items-center gap-3 border-b border-white/[0.06] pb-4 text-sm font-medium text-white/85">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#b8f36b]/[0.08] text-[#b8f36b]"><Icon className="h-4 w-4"/></div> {title}
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>);
}
function Toggle({ label, desc, defaultOn }) {
    const [on, setOn] = useState(!!defaultOn);
    return (<button type="button" aria-pressed={on} onClick={() => setOn((o) => !o)} className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition hover:border-[#b8f36b]/20 hover:bg-white/[0.035]">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-white/40">{desc}</div>
      </div>
      <div className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-[#b8f36b]" : "bg-white/10"}`}>
        <div className={`absolute top-0.5 h-5 w-5 rounded-full transition ${on ? "left-5 bg-[#14200d]" : "left-0.5 bg-white/75"}`}/>
      </div>
    </button>);
}
