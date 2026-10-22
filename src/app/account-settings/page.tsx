import { redirect } from "next/navigation";
import Link from "next/link";
import { changeRestaurantPasswordAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/supabase/auth";
import { PasswordField } from "@/components/password-field";

export default async function AccountSettingsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const metadata = (user as { app_metadata?: { must_change_password?: boolean; cafeos_account_type?: string } }).app_metadata;
  if (metadata?.must_change_password) redirect("/change-password?first=1");
  if (metadata?.cafeos_account_type !== "restaurant_owner") redirect("/login");
  const params = await searchParams;

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-6 py-10">
      <header className="flex items-center justify-between border-b border-[var(--border)] pb-5">
        <Link href="/app" className="text-xl font-bold">Cafe<span className="text-[var(--accent)]">OS</span></Link>
        <Link href="/app" className="text-sm font-semibold text-[var(--accent)]">Back to workspace</Link>
      </header>
      <section className="mt-8 rounded-3xl border border-[var(--border)] bg-white p-7 shadow-sm sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Account security</p>
        <h1 className="mt-3 text-3xl font-semibold">Change password</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Enter your current password to reauthenticate before choosing a new password. Other sessions will be signed out after a successful change.</p>
        {params.error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{params.error}</p>}
        <form action={changeRestaurantPasswordAction} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">Current password<PasswordField name="current_password" placeholder="Enter current password" autoComplete="current-password" /></label>
          <label className="block text-sm font-medium">New password<PasswordField name="password" placeholder="Create a strong new password" autoComplete="new-password" /></label>
          <label className="block text-sm font-medium">Confirm new password<PasswordField name="confirm_password" placeholder="Enter the new password again" autoComplete="new-password" /></label>
          <button className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-white">Update password</button>
        </form>
      </section>
    </main>
  );
}
