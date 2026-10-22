import Link from "next/link";
import { redirect } from "next/navigation";
import { signInAction } from "@/app/actions/auth";
import { authConfigured, getCurrentUser } from "@/lib/supabase/auth";

type Props = { searchParams: Promise<{ error?: string; notice?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (user) redirect("/app");
  const params = await searchParams;
  const configured = authConfigured();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-8 text-xl font-bold tracking-tight">Cafe<span className="text-[var(--accent)]">OS</span></Link>
      <section className="rounded-3xl border border-[var(--border)] bg-white p-7 shadow-sm sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Welcome back</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Sign in to CafeOS</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Access your café workspace and branch operations.</p>
        {params.error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{params.error}</p>}
        {params.notice && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{params.notice}</p>}
        {!configured && <p role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Authentication is not configured yet. Add the Supabase URL and publishable key to your local environment.</p>}
        <form action={signInAction} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">Email address
            <input name="email" type="email" autoComplete="email" required maxLength={320} className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3 outline-none focus:border-[var(--accent)]" />
          </label>
          <label className="block text-sm font-medium">Password
            <input name="password" type="password" autoComplete="current-password" required className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3 outline-none focus:border-[var(--accent)]" />
          </label>
          <button disabled={!configured} className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Sign in</button>
        </form>
        <div className="mt-5 flex flex-wrap justify-between gap-3 text-sm">
          <Link href="/forgot-password" className="font-medium text-[var(--accent)]">Forgot password?</Link>
          <Link href="/signup" className="font-medium text-[var(--accent)]">Create an account</Link>
        </div>
      </section>
      <p className="mt-6 text-center text-xs text-[var(--muted)]">Your café data is isolated by workspace membership and database policies.</p>
    </main>
  );
}
