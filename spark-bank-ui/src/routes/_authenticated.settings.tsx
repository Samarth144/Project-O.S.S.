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
  const [theme, setTheme] = useState<"dark" | "system" | "light">("dark");
  const [language, setLanguage] = useState("English (India)");

  const handleLogout = () => { signOut(); navigate({ to: "/login" }); };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-sm text-muted-foreground">Preferences</div>
        <h1 className="text-3xl font-semibold tracking-tight mt-1">Settings</h1>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section icon={Palette} title="Appearance">
          <div className="text-xs text-muted-foreground mb-2">Theme</div>
          <div className="inline-flex rounded-xl glass p-1">
            {(["dark", "system", "light"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`px-3 py-1.5 text-xs rounded-lg capitalize ${theme === t ? "bg-white/10" : "text-muted-foreground"}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="text-xs text-muted-foreground mt-3">
            Nexa Bank is optimized for dark mode. Light mode preview coming soon.
          </div>
        </Section>

        <Section icon={Bell} title="Notifications">
          <Toggle label="Transaction alerts" desc="Real-time push for debits & credits" defaultOn />
          <Toggle label="Bill reminders" desc="3-day reminders before due date" defaultOn />
          <Toggle label="Promotional offers" desc="Exclusive deals & rewards" />
          <Toggle label="Security alerts" desc="Sign-ins & security events" defaultOn />
        </Section>

        <Section icon={Globe} title="Language & region">
          <div className="text-xs text-muted-foreground mb-2">Language</div>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-sm"
          >
            {["English (India)", "हिंदी", "தமிழ்", "മലയാളം", "ಕನ್ನಡ"].map((l) => (
              <option key={l} value={l} className="bg-[oklch(0.2_0.03_265)]">{l}</option>
            ))}
          </select>
        </Section>

        <Section icon={EyeOff} title="Privacy">
          <Toggle label="Hide balances by default" desc="Balances stay hidden until you tap to reveal" />
          <Toggle label="Analytics improvements" desc="Help improve our services with anonymous data" defaultOn />
          <Toggle label="Personalized recommendations" desc="Tailored insights based on your activity" defaultOn />
        </Section>

        <Section icon={Lock} title="Security">
          <Toggle label="Two-factor authentication" desc="OTP required on new devices" defaultOn />
          <Toggle label="Biometric sign-in" desc="Face ID or fingerprint on trusted devices" defaultOn />
          <div className="pt-2">
            <button className="w-full rounded-xl glass py-2.5 text-sm hover:bg-white/10 inline-flex items-center justify-center gap-2">
              <Fingerprint className="h-4 w-4" /> Change transaction PIN
            </button>
          </div>
        </Section>

        <Section icon={ShieldCheck} title="Session">
          <div className="text-sm text-muted-foreground">
            You are signed in on 3 devices. Sign out from the current device below or manage all sessions from Profile.
          </div>
          <button
            onClick={handleLogout}
            className="mt-2 w-full rounded-xl bg-destructive/20 text-destructive border border-destructive/30 py-2.5 text-sm font-medium hover:bg-destructive/30 inline-flex items-center justify-center gap-2"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </Section>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Bell; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl glass-strong p-6 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Toggle({ label, desc, defaultOn }: { label: string; desc: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <button onClick={() => setOn((o) => !o)} className="w-full flex items-center gap-3 rounded-xl glass p-3 hover:bg-white/10 text-left">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <div className={`relative h-6 w-11 rounded-full transition shrink-0 ${on ? "bg-primary" : "bg-white/10"}`}>
        <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${on ? "left-5" : "left-0.5"}`} />
      </div>
    </button>
  );
}
