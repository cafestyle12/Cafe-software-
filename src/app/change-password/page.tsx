import Link from "next/link";
import { redirect } from "next/navigation";
import { changeRestaurantPasswordAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/supabase/auth";
import { adminFetch } from "@/lib/supabase/restaurant-auth";
import { PasswordField } from "@/components/password-field";

export default async function ChangePasswordPage({ searchParams }: { searchParams: Promise<{ first?: string; error?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const metadata = (user as { app_metadata?: { must_change_password?: boolean } }).app_metadata;
  const accounts = await adminFetch<Array<{ status: string; must_change_password: boolean }>>(
    `/rest/v1/restaurant_auth_accounts?select=status,must_change_password&auth_user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
  );
  const account = accounts.data?.[0];
  if (!accounts.ok || !account || account.status !== "active") redirect("/login?error=Account%20is%20unavailable");
  const firstLogin = metadata?.must_change_password === true || account.must_change_password;
  if (!firstLogin) redirect("/account-settings");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-12">
      <Link href="/" className="text-xl font-bold">Cafe<span className="text-[var(--accent)]">OS</span></Link>
      <section className="mt-8 rounded-3xl border border-[var(--border)] bg-white p-7 shadow-sm sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">First sign-in security</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Set your own password</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Your administrator-issued temporary password must be replaced before your restaurant workspace can be opened.</p>
        {params.error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{params.error}</p>}
        <form action={changeRestaurantPasswordAction} className="mt-6 space-y-4">
          <input type="hidden" name="first_login" value="1" />
          <label className="block text-sm font-medium">Temporary password<PasswordField name="current_password" placeholder="Enter the password provided by CafeOS" autoComplete="current-password" /></label>
          <label className="block text-sm font-medium">New password<PasswordField name="password" placeholder="Create a strong new password" autoComplete="new-password" /></label>
          <label className="block text-sm font-medium">Confirm new password<PasswordField name="confirm_password" placeholder="Enter the new password again" autoComplete="new-password" /></label>
          <button className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-white">Change password securely</button>
        </form>
        <p className="mt-5 text-xs leading-5 text-[var(--muted)]">Use 12–128 characters with uppercase and lowercase letters, a number, and a symbol. Your new password must differ from the temporary password. You will be asked to sign in again after changing it.</p>
      </section>
    </main>
  );
}
