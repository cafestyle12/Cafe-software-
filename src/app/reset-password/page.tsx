import Link from "next/link";
import { redirect } from "next/navigation";
import { updatePasswordAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/supabase/auth";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function ResetPasswordPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?error=Open%20the%20password%20recovery%20link%20from%20your%20email%20first");
  const params = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-8 text-xl font-bold tracking-tight">Cafe<span className="text-[var(--accent)]">OS</span></Link>
      <section className="rounded-3xl border border-[var(--border)] bg-white p-7 shadow-sm sm:p-9">
        <h1 className="text-3xl font-semibold tracking-tight">Choose a new password</h1>
        {params.error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{params.error}</p>}
        <form action={updatePasswordAction} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">New password
            <input name="password" type="password" autoComplete="new-password" required minLength={10} className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3 outline-none focus:border-[var(--accent)]" />
          </label>
          <label className="block text-sm font-medium">Confirm new password
            <input name="confirm_password" type="password" autoComplete="new-password" required minLength={10} className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3 outline-none focus:border-[var(--accent)]" />
          </label>
          <button className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-white">Update password</button>
        </form>
      </section>
    </main>
  );
}
