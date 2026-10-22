import Link from "next/link";
import { requestPasswordResetAction } from "@/app/actions/auth";

type Props = { searchParams: Promise<{ error?: string; sent?: string }> };

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-8 text-xl font-bold tracking-tight">Cafe<span className="text-[var(--accent)]">OS</span></Link>
      <section className="rounded-3xl border border-[var(--border)] bg-white p-7 shadow-sm sm:p-9">
        <h1 className="text-3xl font-semibold tracking-tight">Reset your password</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">We’ll send a recovery link if the account can receive email.</p>
        {params.error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{params.error}</p>}
        {params.sent && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">If that address is registered, a recovery email should arrive shortly. Check your spam folder too.</p>}
        <form action={requestPasswordResetAction} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">Email address
            <input name="email" type="email" autoComplete="email" required maxLength={320} className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3 outline-none focus:border-[var(--accent)]" />
          </label>
          <button className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-white">Send recovery link</button>
        </form>
        <Link href="/login" className="mt-5 inline-block text-sm font-semibold text-[var(--accent)]">Back to sign in</Link>
      </section>
    </main>
  );
}
