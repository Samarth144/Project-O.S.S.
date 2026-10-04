import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { BadgeCheck, Phone, Mail, MapPin, Calendar, IdCard, Smartphone, Laptop, Tablet, Shield } from "lucide-react";
import { user, accounts, devices } from "@/lib/mock-data";
export const Route = createFileRoute("/_authenticated/profile")({
    head: () => ({ meta: [{ title: "Profile — Nexa Bank" }] }),
    component: ProfilePage,
});
const deviceIcon = (name) => (name.includes("iPad") ? Tablet : name.includes("Mac") ? Laptop : Smartphone);
function ProfilePage() {
    return (<div className="w-full min-w-0 space-y-7 sm:space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-[11px] font-medium tracking-[0.16em] text-[#b8f36b]">ACCOUNT OVERVIEW</div>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.05em] sm:text-4xl">Profile</h1>
        <p className="mt-2 text-sm text-white/45">Your personal details, linked accounts and trusted devices.</p>
      </motion.div>

      {/* Identity */}
      <div className="relative overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#11171d] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-24 h-64 w-64 rounded-full border border-[#b8f36b]/[0.08]"/><div className="pointer-events-none absolute -right-4 -top-16 h-48 w-48 rounded-full border border-[#b8f36b]/[0.06]"/>
        <div className="flex flex-wrap items-center gap-5">
          <div className="relative grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-[#d5ff83] to-[#8bd44d] text-2xl font-semibold text-[#14200d] shadow-[0_12px_40px_-15px_rgba(184,243,107,0.45)]">
            {user.avatar}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xl font-semibold text-white/90">{user.name}</div>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#b8f36b]/20 bg-[#b8f36b]/[0.07] px-2.5 py-1 text-xs text-[#c4f889]">
                <BadgeCheck className="h-3.5 w-3.5"/> KYC {user.kyc}
              </span>
            </div>
            <div className="mt-1 text-sm text-white/45">Customer since {user.since}</div>
          </div>
          <button className="rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 py-2 text-sm text-white/65 transition hover:border-[#b8f36b]/25 hover:text-[#c4f889]">Edit profile</button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 rounded-[24px] border border-white/[0.08] bg-[#11171d]/90 p-5 sm:p-6 lg:col-span-2">
          <div className="text-sm font-medium text-white/85">Personal details</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Info icon={Mail} label="Email" value={user.email}/>
            <Info icon={Phone} label="Phone" value={user.phone}/>
            <Info icon={MapPin} label="Address" value={user.address}/>
            <Info icon={Calendar} label="Date of birth" value={user.dob}/>
            <Info icon={IdCard} label="PAN" value={user.pan}/>
            <Info icon={BadgeCheck} label="KYC status" value={user.kyc}/>
          </div>
        </div>

        <div className="space-y-4 rounded-[24px] border border-white/[0.08] bg-[#11171d]/90 p-5 sm:p-6">
          <div className="text-sm font-medium text-white/85">Linked accounts</div>
          <div className="space-y-3">
            <LinkedAccount label="Savings" number={accounts.savings.number} ifsc={accounts.savings.ifsc}/>
            <LinkedAccount label="Current" number={accounts.current.number} ifsc={accounts.current.ifsc}/>
            <LinkedAccount label="Credit" number={accounts.credit.number} ifsc="—"/>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-[24px] border border-white/[0.08] bg-[#11171d]/90 p-5 sm:p-6">
          <div className="flex items-center gap-2 text-sm font-medium text-white/85">
            <Shield className="h-4 w-4 text-[#b8f36b]"/> Security settings
          </div>
          {[
            { label: "Two-factor authentication", value: "Enabled" },
            { label: "Biometric sign-in", value: "Enabled on 2 devices" },
            { label: "Login alerts", value: "On" },
            { label: "Trusted devices", value: `${devices.length} devices` },
        ].map((r) => (<div key={r.label} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="text-sm text-white/75">{r.label}</div>
              <div className="text-right text-xs text-white/40">{r.value}</div>
            </div>))}
        </div>

        <div className="space-y-4 rounded-[24px] border border-white/[0.08] bg-[#11171d]/90 p-5 sm:p-6">
          <div className="text-sm font-medium text-white/85">Device management</div>
          <div className="space-y-2">
            {devices.map((d) => {
            const Icon = deviceIcon(d.name);
            return (<div key={d.name} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/[0.05] text-white/55">
                    <Icon className="h-4 w-4"/>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium flex items-center gap-2">
                      <span className="truncate text-white/80">{d.name}</span>
                      {d.current && <span className="shrink-0 rounded-full border border-[#b8f36b]/20 bg-[#b8f36b]/[0.07] px-2 py-0.5 text-[10px] text-[#c4f889]">This device</span>}
                    </div>
                    <div className="text-xs text-white/40">{d.location} · {d.lastActive}</div>
                  </div>
                  {!d.current && (<button className="shrink-0 text-xs text-white/40 transition hover:text-rose-300">Revoke</button>)}
                </div>);
        })}
          </div>
        </div>
      </div>
    </div>);
}
function Info({ icon: Icon, label, value }) {
    return (<div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-white/50">
        <Icon className="h-4 w-4"/>
      </div>
      <div className="min-w-0">
        <div className="text-xs text-white/40">{label}</div>
        <div className="truncate text-sm text-white/80">{value}</div>
      </div>
    </div>);
}
function LinkedAccount({ label, number, ifsc }) {
    return (<div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{label}</div>
        <span className="text-xs text-[#c4f889]">Active</span>
      </div>
      <div className="mt-1 text-xs text-white/40">{number} · IFSC {ifsc}</div>
    </div>);
}
