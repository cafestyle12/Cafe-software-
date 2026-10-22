import Link from "next/link";
import { redirect } from "next/navigation";
import { signUpAction } from "@/app/actions/auth";
import { authConfigured, getCurrentUser } from "@/lib/supabase/auth";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function SignupPage({ searchParams }: Props) {
  if (await getCurrentUser()) redirect("/onboarding");
  const params = await searchParams;
  const configured = authConfigured();
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-8 text-xl font-bold tracking-tight">Cafe<span className="text-[var(--accent)]">OS</span></Link>
      <section className="rounded-3xl border border-[var(--border)] bg-white p-7 shadow-sm sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Get started</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Set up a workspace for your café after your email is confirmed.</p>
        {params.error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{params.error}</p>}
        {!configured && <p role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Authentication is not configured. Add the Supabase URL and publishable key to your local environment.</p>}
        <form action={signUpAction} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">Your name
            <input name="full_name" type="text" autoComplete="name" required minLength={2} maxLength={120} className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3 outline-none focus:border-[var(--accent)]" />
          </label>
          <label className="block text-sm font-medium">Email address
            <input name="email" type="email" autoComplete="email" required maxLength={320} className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3 outline-none focus:border-[var(--accent)]" />
          </label>
          <label className="block text-sm font-medium">Password
            <input name="password" type="password" autoComplete="new-password" required minLength={10} className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3 outline-none focus:border-[var(--accent)]" />
            <span className="mt-1 block text-xs font-normal text-[var(--muted)]">Use at least 10 characters.</span>
          </label>
          <button disabled={!configured} className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Create account</button>
        </form>
        <p className="mt-5 text-sm text-[var(--muted)]">Already registered? <Link href="/login" className="font-semibold text-[var(--accent)]">Sign in</Link></p>
      </section>
    </main>
  );
}
