import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/actions/auth";
import { getCurrentUser, supabaseRequest } from "@/lib/supabase/auth";

type Membership = { id: string; tenant_id: string; status: string };
type Tenant = { id: string; name: string; slug: string; status: string; created_at: string };
type Branch = { id: string; tenant_id: string; name: string; timezone: string; currency: string; status: string };

type Props = { searchParams: Promise<{ created?: string; passwordUpdated?: string; inviteAccepted?: string; error?: string }> };

export default async function AppHomePage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const authMeta = (user as { app_metadata?: { cafeos_account_type?: string; must_change_password?: boolean; account_status?: string } }).app_metadata;
  if (authMeta?.cafeos_account_type !== "restaurant_owner" || authMeta.account_status !== "active") redirect("/login?error=Restaurant%20account%20is%20unavailable");
  if (authMeta.must_change_password) redirect("/change-password?first=1");
  const params = await searchParams;
  const membershipResult = await supabaseRequest<Membership[]>(
    `/rest/v1/memberships?select=id,tenant_id,status&user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&order=created_at.asc`,
  );
  if (membershipResult.error) {
    return <main className="mx-auto max-w-4xl px-6 py-16"><h1 className="text-2xl font-semibold">Workspace access unavailable</h1><p className="mt-3 text-sm text-[var(--muted)]">We couldn’t load your memberships. Check your Supabase configuration and database policies, then try again.</p><form action={signOutAction} className="mt-6"><button className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold">Sign out</button></form></main>;
  }
  const memberships = membershipResult.data ?? [];
  if (!memberships.length) redirect("/onboarding");

  const tenants: Tenant[] = [];
  const branchesByTenant: Record<string, Branch[]> = {};
  for (const membership of memberships) {
    const tenantResult = await supabaseRequest<Tenant[]>(
      `/rest/v1/tenants?select=id,name,slug,status,created_at&id=eq.${encodeURIComponent(membership.tenant_id)}&limit=1`,
    );
    const tenant = tenantResult.data?.[0];
    if (!tenant) continue;
    tenants.push(tenant);
    const branchResult = await supabaseRequest<Branch[]>(
      `/rest/v1/branches?select=id,tenant_id,name,timezone,currency,status&tenant_id=eq.${encodeURIComponent(tenant.id)}&status=eq.active&order=created_at.asc`,
    );
    branchesByTenant[tenant.id] = branchResult.data ?? [];
  }

  const displayName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? "Restaurant owner";
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-8 sm:px-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <Link href="/" className="text-xl font-bold tracking-tight">Cafe<span className="text-[var(--accent)]">OS</span></Link>
        <div className="flex items-center gap-4"><span className="text-sm text-[var(--muted)]">{displayName}</span><Link href="/account-settings" className="text-sm font-semibold text-[var(--accent)]">Account settings</Link><form action={signOutAction}><button className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold">Sign out</button></form></div>
      </header>
      <section className="py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Workspace overview</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Good to have you back.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Your authenticated CafeOS workspace hub. Tenant-scoped operations will appear here as the next phases are completed.</p>
        {params.created && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">Workspace and first branch created successfully.</p>}
        {params.passwordUpdated && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">Your password was updated.</p>}
        {params.inviteAccepted && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">Invitation accepted. You now have access to the workspace.</p>}
        {params.error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{params.error}</p>}
      </section>
      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-semibold">Your workspaces</h2><p className="mt-1 text-sm text-[var(--muted)]">Only workspaces where your membership is active are shown.</p></div></div>
        {tenants.length === 0 ? <div className="rounded-2xl border border-[var(--border)] p-6 text-sm text-[var(--muted)]">No workspace is currently visible to your account. Try refreshing or contact the workspace owner.</div> :
          <div className="grid gap-4 md:grid-cols-2">
            {tenants.map((tenant) => (
              <article key={tenant.id} className="rounded-2xl border border-[var(--border)] bg-white p-6">
                <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">{tenant.name}</h3><p className="mt-1 text-sm text-[var(--muted)]">/{tenant.slug}</p></div><span className="rounded-full bg-[#edf2eb] px-3 py-1 text-xs font-semibold text-[var(--accent)]">{tenant.status}</span></div>
                <div className="mt-5 space-y-3">
                  {(branchesByTenant[tenant.id] ?? []).map((branch) => <div key={branch.id} className="flex items-center justify-between rounded-xl border border-[var(--border)] p-3"><div><p className="text-sm font-medium">{branch.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{branch.timezone} · {branch.currency}</p></div><span className="text-xs text-[var(--muted)]">Branch</span></div>)}
                  {(branchesByTenant[tenant.id] ?? []).length === 0 && <p className="text-sm text-[var(--muted)]">No active branches found.</p>}
                  <Link href={`/app/members?tenant=${tenant.id}`} className="inline-flex rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold">Manage team</Link>
                  <Link href={`/app/branches?tenant=${tenant.id}`} className="ml-2 inline-flex rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold">Manage branches</Link>
                  <Link href={`/app/floor-plan?tenant=${tenant.id}`} className="ml-2 inline-flex rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">Tables & floor plan</Link>
                </div>
              </article>
            ))}
          </div>
        }
      </section>
      <footer className="mt-12 border-t border-[var(--border)] py-5 text-xs text-[var(--muted)]">Phase 02 foundation · Authentication enabled when configured · Payments and orders are not enabled</footer>
    </main>
  );
}
