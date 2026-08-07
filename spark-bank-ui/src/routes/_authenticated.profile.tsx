import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { BadgeCheck, Phone, Mail, MapPin, Calendar, IdCard, Smartphone, Laptop, Tablet, Shield } from "lucide-react";
import { user, accounts, devices } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — Nexa Bank" }] }),
  component: ProfilePage,
});

const deviceIcon = (name: string) => (name.includes("iPad") ? Tablet : name.includes("Mac") ? Laptop : Smartphone);

function ProfilePage() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-sm text-muted-foreground">Account</div>
        <h1 className="text-3xl font-semibold tracking-tight mt-1">Profile</h1>
      </motion.div>

      {/* Identity */}
      <div className="rounded-3xl glass-strong p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-5">
          <div className="grid h-20 w-20 place-items-center rounded-3xl bg-[image:var(--gradient-primary)] text-primary-foreground text-2xl font-semibold shadow-[var(--shadow-glow)]">
            {user.avatar}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xl font-semibold">{user.name}</div>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-2 py-0.5 text-xs">
                <BadgeCheck className="h-3.5 w-3.5" /> KYC {user.kyc}
              </span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">Customer since {user.since}</div>
          </div>
          <button className="rounded-xl glass px-4 py-2 text-sm hover:bg-white/10">Edit profile</button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-3xl glass-strong p-6 space-y-4">
          <div className="text-sm font-medium">Personal details</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Info icon={Mail} label="Email" value={user.email} />
            <Info icon={Phone} label="Phone" value={user.phone} />
            <Info icon={MapPin} label="Address" value={user.address} />
            <Info icon={Calendar} label="Date of birth" value={user.dob} />
            <Info icon={IdCard} label="PAN" value={user.pan} />
            <Info icon={BadgeCheck} label="KYC status" value={user.kyc} />
          </div>
        </div>

        <div className="rounded-3xl glass-strong p-6 space-y-4">
          <div className="text-sm font-medium">Linked accounts</div>
          <div className="space-y-3">
            <LinkedAccount label="Savings" number={accounts.savings.number} ifsc={accounts.savings.ifsc} />
            <LinkedAccount label="Current" number={accounts.current.number} ifsc={accounts.current.ifsc} />
            <LinkedAccount label="Credit" number={accounts.credit.number} ifsc="—" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl glass-strong p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Shield className="h-4 w-4 text-primary" /> Security settings
          </div>
          {[
            { label: "Two-factor authentication", value: "Enabled" },
            { label: "Biometric sign-in", value: "Enabled on 2 devices" },
            { label: "Login alerts", value: "On" },
            { label: "Trusted devices", value: `${devices.length} devices` },
          ].map((r) => (
            <div key={r.label} className="flex items-center justify-between rounded-xl glass p-3">
              <div className="text-sm">{r.label}</div>
              <div className="text-xs text-muted-foreground">{r.value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-3xl glass-strong p-6 space-y-4">
          <div className="text-sm font-medium">Device management</div>
          <div className="space-y-2">
            {devices.map((d) => {
              const Icon = deviceIcon(d.name);
              return (
                <div key={d.name} className="flex items-center gap-3 rounded-xl glass p-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/5">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium flex items-center gap-2">
                      {d.name}
                      {d.current && <span className="text-xs rounded-full bg-primary/20 text-primary px-2 py-0.5">This device</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{d.location} · {d.lastActive}</div>
                  </div>
                  {!d.current && (
                    <button className="text-xs text-muted-foreground hover:text-destructive">Revoke</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="rounded-xl glass p-3 flex items-start gap-3">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm truncate">{value}</div>
      </div>
    </div>
  );
}

function LinkedAccount({ label, number, ifsc }: { label: string; number: string; ifsc: string }) {
  return (
    <div className="rounded-xl glass p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{label}</div>
        <span className="text-xs text-primary">Active</span>
      </div>
      <div className="text-xs text-muted-foreground mt-1">{number} · IFSC {ifsc}</div>
    </div>
  );
}
