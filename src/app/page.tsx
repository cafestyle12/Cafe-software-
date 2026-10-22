import Link from "next/link";

import { plannedCapabilities } from "@/lib/roadmap";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 sm:px-10 lg:px-12">
      <header className="flex items-center justify-between border-b border-[var(--border)] pb-5">
        <Link href="/" className="text-lg font-bold tracking-tight" aria-label="CafeOS home">
          Cafe<span className="text-[var(--accent)]">OS</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--muted)] sm:inline">Engineering preview</span>
          <Link href="/login" className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold">Sign in</Link>
          <Link href="/signup" className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white">Get started</Link>
        </div>
      </header>
      <section className="grid flex-1 items-center gap-12 py-16 md:grid-cols-[1.2fr_0.8fr] md:py-24">
        <div>
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">One operating system. Every service.</p>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">More time for hospitality. Less friction behind the counter.</h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-[var(--muted)] sm:text-lg">
            CafeOS is being built for Indian cafés: connected ordering, dependable operations, clear numbers, and workflows that account for real-world connectivity.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <span className="rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white">Phase 02 · Access foundation</span>
            <span className="rounded-lg border border-[var(--border)] px-4 py-3 text-sm font-semibold">India-first · INR</span>
          </div>
          <p className="mt-4 max-w-xl text-xs leading-5 text-[var(--muted)]">Engineering preview. Authentication requires environment configuration and verified Supabase email settings. Ordering, payments, and live café operations are not enabled yet.</p>
        </div>
        <div className="rounded-3xl border border-[var(--border)] bg-white/70 p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex items-center justify-between">
            <div><p className="text-sm font-semibold">Product roadmap</p><p className="mt-1 text-xs text-[var(--muted)]">Capabilities under development</p></div>
            <span className="rounded-full bg-[#edf2eb] px-3 py-1 text-xs font-semibold text-[var(--accent)]">Phase 02</span>
          </div>
          <ul className="space-y-3">
            {plannedCapabilities.map((capability) => (
              <li key={capability.title} className="rounded-2xl border border-[var(--border)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-sm font-semibold">{capability.title}</h2>
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">{capability.status}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{capability.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <footer className="border-t border-[var(--border)] py-5 text-xs text-[var(--muted)]">Built in verified phases · Secure by design · Designed for resilient service</footer>
    </main>
  );
}
