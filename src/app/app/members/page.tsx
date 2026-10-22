import Link from "next/link";
import { redirect } from "next/navigation";
import { revokeInviteAction, setMemberStatusAction } from "@/app/actions/auth";
import { getCurrentUser, supabaseRequest } from "@/lib/supabase/auth";

type Props = { searchParams: Promise<{ tenant?: string; error?: string; notice?: string }> };
type Membership = { id: string; user_id: string; status: string; created_at: string };
type Profile = { user_id: string; display_name: string };
type Role = { id: string; name: string; role_key: string };
type Invite = { id: string; email: string; status: string; expires_at: string; role_id: string };

export default async function MembersPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const tenantId = params.tenant ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) redirect("/app");

  const tenantResult = await supabaseRequest<Array<{ id: string; name: string; slug: string }>>(
    `/rest/v1/tenants?select=id,name,slug&id=eq.${tenantId}&limit=1`,
  );
  const tenant = tenantResult.data?.[0];
  if (!tenant) redirect("/app?error=Workspace%20not%20found");

  const ownMembership = await supabaseRequest<Array<{ id: string }>>(
    `/rest/v1/memberships?select=id&tenant_id=eq.${tenantId}&user_id=eq.${user.id}&status=eq.active&limit=1`,
  );
  if (!ownMembership.data?.[0]) redirect("/app?error=Workspace%20membership%20required");

  const ownRoles = await supabaseRequest<Array<{ role_id: string }>>(
    `/rest/v1/membership_roles?select=role_id&tenant_id=eq.${tenantId}&membership_id=eq.${ownMembership.data[0].id}`,
  );
  const ownRoleIds = (ownRoles.data ?? []).map((row) => row.role_id);
  const roleFilter = ownRoleIds.length ? `(${ownRoleIds.join(",")})` : "(00000000-0000-0000-0000-000000000000)";
  const permissions = ownRoleIds.length ? await supabaseRequest<Array<{ permission_key: string }>>(
    `/rest/v1/role_permissions?select=permission_key&tenant_id=eq.${tenantId}&role_id=in.${roleFilter}`,
  ) : { data: [], error: null, status: 200 };
  const permissionKeys = new Set((permissions.data ?? []).map((row) => row.permission_key));
  const canManageMembers = permissionKeys.has("members.manage");

  const membershipResult = await supabaseRequest<Membership[]>(
    `/rest/v1/memberships?select=id,user_id,status,created_at&tenant_id=eq.${tenantId}&order=created_at.asc`,
  );
  const members = membershipResult.data ?? [];
  const userIds = [...new Set(members.map((member) => member.user_id))];
  const profileResult = userIds.length ? await supabaseRequest<Profile[]>(
    `/rest/v1/profiles?select=user_id,display_name&user_id=in.(${userIds.join(",")})`,
  ) : { data: [], error: null, status: 200 };
  const profileByUser = new Map((profileResult.data ?? []).map((profile) => [profile.user_id, profile.display_name]));

  const roleResult = await supabaseRequest<Role[]>(
    `/rest/v1/roles?select=id,name,role_key&tenant_id=eq.${tenantId}&order=name.asc`,
  );
  const allRoles = roleResult.data ?? [];
  const memberRoleLinks = members.length ? await supabaseRequest<Array<{ membership_id: string; role_id: string }>>(
    `/rest/v1/membership_roles?select=membership_id,role_id&tenant_id=eq.${tenantId}`,
  ) : { data: [], error: null, status: 200 };
  const roleById = new Map(allRoles.map((role) => [role.id, role.name]));
  const roleNamesByMembership = new Map<string, string[]>();
  for (const link of memberRoleLinks.data ?? []) {
    const names = roleNamesByMembership.get(link.membership_id) ?? [];
    const name = roleById.get(link.role_id);
    if (name) names.push(name);
    roleNamesByMembership.set(link.membership_id, names);
  }

  const inviteResult = await supabaseRequest<Invite[]>(
    `/rest/v1/membership_invites?select=id,email,status,expires_at,role_id&tenant_id=eq.${tenantId}&status=eq.pending&order=created_at.desc`,
  );
  const pendingInvites = inviteResult.data ?? [];

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-8 sm:px-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <Link href="/app" className="text-xl font-bold tracking-tight">Cafe<span className="text-[var(--accent)]">OS</span></Link>
        <Link href="/app" className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold">Back to workspaces</Link>
      </header>
      <section className="py-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Workspace administration</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{tenant.name} · Team</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Manage workspace members, invitations, and access status.</p>
        {params.error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{params.error}</p>}
        {params.notice && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{params.notice}</p>}
      </section>

      {canManageMembers && <section className="mb-8 rounded-2xl border border-[var(--border)] bg-white p-6">
        <h2 className="text-lg font-semibold">Team member access</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Email-based invitations are disabled in the Restaurant ID authentication design. Do not send invites that cannot be used to sign in. The platform administrator currently provisions restaurant owner accounts; member credential provisioning requires a separate reviewed flow.</p>
      </section>}

      <section className="mb-8">
        <h2 className="text-lg font-semibold">Members <span className="text-sm font-normal text-[var(--muted)]">({members.length})</span></h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
          {members.map((member) => <div key={member.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] p-4 last:border-b-0">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{profileByUser.get(member.user_id) || "CafeOS member"}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{member.user_id === user.id ? "You" : "Member ID: " + member.user_id.slice(0, 8)} · {(roleNamesByMembership.get(member.id) ?? []).join(", ") || "No role assigned"}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium">{member.status}</span>
              {canManageMembers && member.user_id !== user.id && member.status === "active" && <form action={setMemberStatusAction} className="flex gap-2">
                <input type="hidden" name="tenant_id" value={tenantId} /><input type="hidden" name="membership_id" value={member.id} />
                <button name="status" value="disabled" className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold">Disable</button>
                <button name="status" value="revoked" className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Revoke</button>
              </form>}
            </div>
          </div>)}
          {members.length === 0 && <p className="p-5 text-sm text-[var(--muted)]">No members are visible to this account.</p>}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Pending invitations <span className="text-sm font-normal text-[var(--muted)]">({pendingInvites.length})</span></h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
          {pendingInvites.map((invite) => <div key={invite.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] p-4 last:border-b-0">
            <div><p className="text-sm font-semibold">{invite.email}</p><p className="mt-1 text-xs text-[var(--muted)]">{roleById.get(invite.role_id) ?? "Assigned role"} · Expires {new Date(invite.expires_at).toLocaleDateString("en-IN")}</p></div>
            {canManageMembers && <form action={revokeInviteAction}><input type="hidden" name="tenant_id" value={tenantId} /><input type="hidden" name="invite_id" value={invite.id} /><button className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Revoke invite</button></form>}
          </div>)}
          {pendingInvites.length === 0 && <p className="p-5 text-sm text-[var(--muted)]">No pending invitations.</p>}
        </div>
      </section>
    </main>
  );
}
