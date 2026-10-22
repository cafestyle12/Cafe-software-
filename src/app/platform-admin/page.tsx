import { createHash, timingSafeEqual } from "node:crypto";
import Link from "next/link";
import { cookies } from "next/headers";
import { loginPlatformAdminAction, logoutPlatformAdminAction, changeRestaurantStatusAction } from "@/app/actions/platform-admin";
import { ResetPasswordForm } from "./reset-password-form";
import { adminFetch } from "@/lib/supabase/restaurant-auth";
import { ProvisionRestaurantForm } from "./provision-form";

const ADMIN_COOKIE = "cafeos_platform_admin";

function equal(a: string, b: string) {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

type Account = { tenant_id: string; restaurant_id: string; status: string; must_change_password: boolean; auth_user_id: string; created_at: string };

export default async function PlatformAdminPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string; reset?: string }> }) {
  const params = await searchParams;
  const jar = await cookies();
  const expected = process.env.CAFEOS_PLATFORM_ADMIN_TOKEN;
  const session = jar.get(ADMIN_COOKIE)?.value ?? "";
  const authorized = Boolean(expected && session && equal(expected, session));

  if (!authorized) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-12">
        <Link href="/" className="text-xl font-bold">Cafe<span className="text-[var(--accent)]">OS</span></Link>
        <section className="mt-8 rounded-3xl border border-[var(--border)] bg-white p-7 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Restricted access</p>
          <h1 className="mt-3 text-3xl font-semibold">Platform administration</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Only the CafeOS platform administrator can provision, suspend or reset restaurant owner accounts.</p>
          {params.error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{params.error}</p>}
          {!expected || expected.length < 10 ? <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Setup required: set CAFEOS_PLATFORM_ADMIN_TOKEN to a password of at least 10 characters and configure a server-only Supabase secret in the Vercel environment.</p> : (
            <form action={loginPlatformAdminAction} className="mt-5 space-y-4">
              <label className="block text-sm font-medium">Administrator password
                <input name="admin_token" type="password" required autoComplete="current-password" className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3" />
              </label>
              <button className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-white">Unlock administration</button>
            </form>
          )}
        </section>
      </main>
    );
  }

  const list = await adminFetch<Account[]>("/rest/v1/restaurant_auth_accounts?select=tenant_id,restaurant_id,status,must_change_password,auth_user_id,created_at&order=created_at.desc");
  const accounts = list.data ?? [];
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-8 sm:px-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div><Link href="/" className="text-xl font-bold">Cafe<span className="text-[var(--accent)]">OS</span></Link><p className="mt-1 text-sm text-[var(--muted)]">Platform administration</p></div>
        <form action={logoutPlatformAdminAction}><button className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold">Lock admin session</button></form>
      </header>
      <section className="py-8">
        <h1 className="text-3xl font-semibold">Restaurant accounts</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Create owner credentials, issue administrator-controlled password resets, and suspend access. Temporary passwords are never written to logs or stored for later retrieval.</p>
        {params.error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{params.error}</p>}
        {params.notice && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{params.notice}</p>}
        {!list.ok && <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Could not load restaurant accounts. Confirm the server-only Supabase secret and apply the Phase 02 restaurant-auth migration.</p>}

      </section>
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <ProvisionRestaurantForm />
        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Provisioned accounts ({accounts.length})</h2>
          {accounts.length === 0 ? <p className="mt-4 text-sm text-[var(--muted)]">No restaurant accounts have been provisioned yet.</p> : (
            <div className="mt-4 space-y-4">
              {accounts.map((account) => (
                <article key={account.tenant_id} className="rounded-xl border border-[var(--border)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="font-semibold">{account.restaurant_id}</p><p className="mt-1 text-xs text-[var(--muted)]">Created {new Date(account.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p></div>
                    <span className="rounded-full border px-3 py-1 text-xs font-semibold">{account.status}</span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">{account.must_change_password ? "Temporary password change required" : "Owner password set"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ResetPasswordForm restaurantId={account.restaurant_id} />
                    {account.status === "active" ? <form action={changeRestaurantStatusAction}><input type="hidden" name="restaurant_id" value={account.restaurant_id} /><input type="hidden" name="status" value="suspended" /><button className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold">Suspend</button></form> : <form action={changeRestaurantStatusAction}><input type="hidden" name="restaurant_id" value={account.restaurant_id} /><input type="hidden" name="status" value="active" /><button className="rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold">Reactivate</button></form>}
                    {account.status !== "deactivated" && <form action={changeRestaurantStatusAction}><input type="hidden" name="restaurant_id" value={account.restaurant_id} /><input type="hidden" name="status" value="deactivated" /><button className="rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold">Deactivate</button></form>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
