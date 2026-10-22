import Link from "next/link";
import { redirect } from "next/navigation";
import { createTenantAction } from "@/app/actions/tenant";
import { getCurrentUser, supabaseRequest } from "@/lib/supabase/auth";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function OnboardingPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const memberships = await supabaseRequest<Array<{ id: string }>>(
    `/rest/v1/memberships?select=id&user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&limit=1`,
  );
  if (memberships.data?.length) redirect("/app");
  const params = await searchParams;
  const fullName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? "";
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-8 text-xl font-bold tracking-tight">Cafe<span className="text-[var(--accent)]">OS</span></Link>
      <section className="rounded-3xl border border-[var(--border)] bg-white p-7 shadow-sm sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Workspace setup · 1 of 1</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Let’s set up your café</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">This creates your workspace, assigns you the Owner role, and creates the first branch in India Standard Time (INR).</p>
        {params.error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{params.error}</p>}
        <form action={createTenantAction} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">Workspace / café group name
            <input name="tenant_name" type="text" required minLength={2} maxLength={120} placeholder="e.g. The Daily Grind" defaultValue={fullName ? `${fullName}'s Café` : ""} className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3 outline-none focus:border-[var(--accent)]" />
          </label>
          <label className="block text-sm font-medium">Workspace URL slug
            <input name="tenant_slug" type="text" minLength={2} maxLength={80} pattern="[a-zA-Z0-9-]+" placeholder="e.g. daily-grind" className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3 outline-none focus:border-[var(--accent)]" />
            <span className="mt-1 block text-xs font-normal text-[var(--muted)]">Optional. Lowercase letters, numbers and hyphens; we’ll generate one from your name if blank.</span>
          </label>
          <label className="block text-sm font-medium">First branch name
            <input name="branch_name" type="text" required minLength={2} maxLength={120} placeholder="e.g. Main Street" className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3 outline-none focus:border-[var(--accent)]" />
          </label>
          <div className="rounded-xl bg-[#f7f5ef] p-4 text-sm leading-6 text-[var(--muted)]">Defaults: <strong className="text-[var(--foreground)]">Asia/Kolkata</strong> timezone · <strong className="text-[var(--foreground)]">INR</strong> currency · Owner permissions.</div>
          <button className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-white">Create workspace</button>
        </form>
      </section>
    </main>
  );
}
