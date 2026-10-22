"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { authApi, clearAuthAttempts, clearAuthSession, consumeAuthAttempt, setAuthSession, siteUrl } from "@/lib/supabase/auth";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function emailIsValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;
}

export async function signInAction(formData: FormData) {
  const restaurantId = value(formData, "restaurant_id").toUpperCase().replace(/\s+/g, "");
  const password = String(formData.get("password") ?? "");
  if (!/^CAFE-[A-Z0-9]{4}-[A-Z0-9]{8}$/.test(restaurantId) || password.length < 1) {
    redirect("/login?error=Invalid%20Restaurant%20ID%20or%20password");
  }

  const { headers } = await import("next/headers");
  const { adminFetch, consumeRestaurantLoginLimit, clearRestaurantLoginLimit } = await import("@/lib/supabase/restaurant-auth");
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-real-ip") ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await consumeRestaurantLoginLimit(restaurantId, ip);
  if (!limit.ok || !limit.decision) {
    redirect("/login?error=Sign%20in%20is%20temporarily%20unavailable.%20Please%20try%20again%20later");
  }
  if (!limit.decision.allowed) {
    redirect("/login?error=Too%20many%20attempts.%20Please%20wait%2015%20minutes%20before%20trying%20again");
  }

  const accounts = await adminFetch<Array<{ tenant_id: string; auth_user_id: string; auth_email: string; status: string; must_change_password: boolean }>>(
    `/rest/v1/restaurant_auth_accounts?select=tenant_id,auth_user_id,auth_email,status,must_change_password&restaurant_id=eq.${encodeURIComponent(restaurantId)}&limit=1`,
  );
  const account = accounts.data?.[0];
  if (!accounts.ok || !account || account.status !== "active") {
    redirect("/login?error=Invalid%20Restaurant%20ID%20or%20password");
  }

  const result = await authApi("/auth/v1/token?grant_type=password", { email: account.auth_email, password });
  if (!result.ok || !result.payload?.access_token || !result.payload.refresh_token || result.payload.user?.id !== account.auth_user_id) {
    redirect("/login?error=Invalid%20Restaurant%20ID%20or%20password");
  }
  await clearRestaurantLoginLimit(limit.keys);
  await clearAuthAttempts("login");
  await setAuthSession({ access_token: result.payload.access_token, refresh_token: result.payload.refresh_token, expires_in: result.payload.expires_in, user: result.payload.user });
  const appMetadata = (result.payload.user as { app_metadata?: { must_change_password?: boolean; account_status?: string } }).app_metadata;
  if (account.must_change_password || appMetadata?.must_change_password === true) redirect("/change-password?first=1");
  redirect("/app");
}





export async function changeRestaurantPasswordAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");
  const currentPassword = String(formData.get("current_password") ?? "");
  if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password) || password !== confirm) {
    redirect("/change-password?error=Use%20a%20matching%20password%20of%2012%20or%20more%20characters%20with%20uppercase%2C%20lowercase%2C%20number%20and%20symbol");
  }

  const { getCurrentUser, currentAccessToken } = await import("@/lib/supabase/auth");
  const { adminFetch } = await import("@/lib/supabase/restaurant-auth");
  const user = await getCurrentUser();
  const accessToken = await currentAccessToken();
  if (!user || !accessToken) redirect("/login?error=Please%20sign%20in%20again");
  const appMetadata = (user as { app_metadata?: { must_change_password?: boolean; account_status?: string } }).app_metadata;
  const firstLogin = appMetadata?.must_change_password === true;

  const cfgUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const cfgKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!cfgUrl || !cfgKey) redirect("/change-password?error=Authentication%20is%20not%20configured");

  if (!firstLogin) {
    if (currentPassword.length < 1) redirect("/change-password?error=Enter%20your%20current%20password");
    const accounts = await adminFetch<Array<{ auth_email: string; status: string }>>(
      `/rest/v1/restaurant_auth_accounts?select=auth_email,status&auth_user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
    );
    const account = accounts.data?.[0];
    if (!accounts.ok || !account || account.status !== "active") redirect("/login?error=Account%20is%20unavailable");
    const reauth = await authApi("/auth/v1/token?grant_type=password", { email: account.auth_email, password: currentPassword });
    if (!reauth.ok) redirect("/change-password?error=Current%20password%20is%20incorrect");
  }

  const updated = await adminFetch<{ id: string }>(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
    method: "PUT",
    body: JSON.stringify({
      password,
      app_metadata: { ...(appMetadata ?? {}), must_change_password: false, account_status: "active" },
    }),
  });
  if (!updated.ok) redirect("/change-password?error=Password%20could%20not%20be%20updated.%20Please%20try%20again");

  const profileUpdate = await adminFetch<Array<{ tenant_id: string }>>(
    `/rest/v1/restaurant_auth_accounts?auth_user_id=eq.${encodeURIComponent(user.id)}`,
    { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ must_change_password: false, password_changed_at: new Date().toISOString(), updated_at: new Date().toISOString() }) },
  );
  if (!profileUpdate.ok || !profileUpdate.data?.length) {
    // The Auth password changed, but fail closed at the database membership gate until the flag is reconciled.
    redirect("/change-password?error=Password%20changed%2C%20but%20account%20activation%20is%20pending.%20Please%20contact%20CafeOS%20support");
  }
  const logout = await fetch(`${cfgUrl}/auth/v1/logout?scope=global`, {
    method: "POST",
    headers: { apikey: cfgKey, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  }).catch(() => null);
  await clearAuthSession();
  redirect("/login?notice=Password%20updated.%20Please%20sign%20in%20with%20your%20new%20password");
}

export async function completeAuthSessionAction(accessToken: string, refreshToken: string, type: string, inviteId = "") {
  const allowedTypes = new Set(["invite"]);
  const cfgUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const cfgKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!cfgUrl || !cfgKey || !allowedTypes.has(type) || accessToken.length < 20 || refreshToken.length < 20) {
    redirect("/login?error=This%20confirmation%20link%20is%20invalid%20or%20expired");
  }
  const verified = await fetch(`${cfgUrl}/auth/v1/user`, {
    headers: { apikey: cfgKey, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!verified.ok) redirect("/login?error=This%20confirmation%20link%20is%20invalid%20or%20expired");
  const user = await verified.json() as { id: string; email?: string; user_metadata?: { full_name?: string; name?: string } };
  if (type === "invite") await acceptInvitation(inviteId, user.id, user.email ?? "");
  await setAuthSession({ access_token: accessToken, refresh_token: refreshToken, expires_in: 3600, user });
  redirect("/app?inviteAccepted=1");
}

export async function verifyConfirmationAction(tokenHash: string, type: string, inviteId = "") {
  const allowedTypes = new Set(["invite"]);
  const cfgUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const cfgKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!cfgUrl || !cfgKey || !allowedTypes.has(type) || tokenHash.length < 10 || tokenHash.length > 512) {
    redirect("/login?error=This%20confirmation%20link%20is%20invalid%20or%20expired");
  }
  const response = await fetch(`${cfgUrl}/auth/v1/verify`, {
    method: "POST",
    headers: { apikey: cfgKey, "Content-Type": "application/json" },
    body: JSON.stringify({ token_hash: tokenHash, type }),
    cache: "no-store",
  });
  if (!response.ok) redirect("/login?error=This%20confirmation%20link%20is%20invalid%20or%20expired");
  const session = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; user?: { id: string; email?: string } };
  if (session.access_token && session.refresh_token) {
    if (type === "invite") await acceptInvitation(inviteId, session.user?.id ?? "", session.user?.email ?? "");
    await setAuthSession({ access_token: session.access_token, refresh_token: session.refresh_token, expires_in: session.expires_in, user: session.user });
    redirect("/app?inviteAccepted=1");
  }
  redirect("/login?notice=Email%20confirmed.%20You%20can%20now%20sign%20in");
}


async function acceptInvitation(inviteId: string, userId: string, email: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret || !/^[0-9a-f-]{36}$/i.test(inviteId) || !userId || !email) {
    redirect("/login?error=Invitation%20acceptance%20is%20not%20configured%20or%20the%20link%20is%20invalid");
  }
  const response = await fetch(`${url}/rest/v1/rpc/accept_membership_invite`, {
    method: "POST",
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ invite_uuid: inviteId, accepted_user_id: userId }),
    cache: "no-store",
  });
  if (!response.ok) redirect("/login?error=This%20invitation%20is%20invalid%2C%20expired%2C%20or%20belongs%20to%20another%20email");
}

export async function inviteMemberAction(formData: FormData) {
  const user = await (await import("@/lib/supabase/auth")).getCurrentUser();
  if (!user) redirect("/login");
  const tenantId = value(formData, "tenant_id");
  const roleId = value(formData, "role_id");
  const email = value(formData, "email").toLowerCase();
  if (!/^[0-9a-f-]{36}$/i.test(tenantId) || !/^[0-9a-f-]{36}$/i.test(roleId) || !emailIsValid(email)) {
    redirect(`/app/members?tenant=${encodeURIComponent(tenantId)}&error=Enter%20a%20valid%20email%20and%20role`);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const baseUrl = siteUrl();
  if (!url || !secret || !baseUrl) redirect(`/app/members?tenant=${encodeURIComponent(tenantId)}&error=Invitation%20email%20or%20site%20URL%20is%20not%20configured%20yet`);

  const currentMembership = await (await import("@/lib/supabase/auth")).supabaseRequest<Array<{ id: string }>>(
    `/rest/v1/memberships?select=id&tenant_id=eq.${tenantId}&user_id=eq.${user.id}&status=eq.active&limit=1`,
  );
  const membershipId = currentMembership.data?.[0]?.id;
  if (!membershipId) redirect("/app?error=Workspace%20membership%20required");

  const links = await (await import("@/lib/supabase/auth")).supabaseRequest<Array<{ role_id: string }>>(
    `/rest/v1/membership_roles?select=role_id&tenant_id=eq.${tenantId}&membership_id=eq.${membershipId}`,
  );
  const ownRoleIds = (links.data ?? []).map((row) => row.role_id);
  if (!ownRoleIds.length) redirect(`/app/members?tenant=${tenantId}&error=You%20do%20not%20have%20invitation%20permissions`);
  const ownRoleFilter = `(${ownRoleIds.join(",")})`;
  const ownPermissions = await (await import("@/lib/supabase/auth")).supabaseRequest<Array<{ role_id: string }>>(
    `/rest/v1/role_permissions?select=role_id&tenant_id=eq.${tenantId}&permission_key=eq.members.manage&role_id=in.${ownRoleFilter}`,
  );
  if (!ownPermissions.data?.length) redirect(`/app/members?tenant=${tenantId}&error=You%20do%20not%20have%20invitation%20permissions`);
  const canManageRoles = await (await import("@/lib/supabase/auth")).supabaseRequest<Array<{ role_id: string }>>(
    `/rest/v1/role_permissions?select=role_id&tenant_id=eq.${tenantId}&permission_key=eq.roles.manage&role_id=in.${ownRoleFilter}`,
  );

  const role = await (await import("@/lib/supabase/auth")).supabaseRequest<Array<{ id: string; name: string; role_key: string }>>(
    `/rest/v1/roles?select=id,name,role_key&tenant_id=eq.${tenantId}&id=eq.${roleId}&limit=1`,
  );
  if (!role.data?.length) redirect(`/app/members?tenant=${tenantId}&error=The%20selected%20role%20is%20not%20available`);
  const rolePermissions = await (await import("@/lib/supabase/auth")).supabaseRequest<Array<{ permission_key: string }>>(
    `/rest/v1/role_permissions?select=permission_key&tenant_id=eq.${tenantId}&role_id=eq.${roleId}`,
  );
  if (!canManageRoles.data?.length && rolePermissions.data?.some((p) => p.permission_key === "roles.manage")) {
    redirect(`/app/members?tenant=${tenantId}&error=Only%20an%20owner%20can%20assign%20that%20role`);
  }

  const tokenHash = randomBytes(32).toString("hex");
  const inserted = await (await import("@/lib/supabase/auth")).supabaseRequest<Array<{ id: string }>>(
    "/rest/v1/membership_invites?select=id",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ tenant_id: tenantId, email, role_id: roleId, invited_by: user.id, token_hash: tokenHash }),
    },
  );
  const inviteId = inserted.data?.[0]?.id;
  if (inserted.error || !inviteId) redirect(`/app/members?tenant=${tenantId}&error=Could%20not%20create%20the%20invitation`);

  const redirectTo = `${baseUrl}/auth/confirm?invite_id=${encodeURIComponent(inviteId)}`;
  const inviteResponse = await fetch(`${url}/auth/v1/invite?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    cache: "no-store",
  });
  if (!inviteResponse.ok) {
    await (await import("@/lib/supabase/auth")).supabaseRequest(
      `/rest/v1/membership_invites?id=eq.${inviteId}`,
      { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "revoked" }) },
    );
    redirect(`/app/members?tenant=${tenantId}&error=Invitation%20could%20not%20be%20sent.%20Check%20email%20configuration%20or%20whether%20the%20account%20already%20exists`);
  }

  await (await import("@/lib/supabase/auth")).supabaseRequest("/rest/v1/audit_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ tenant_id: tenantId, actor_id: user.id, action: "member.invitation_sent", entity_type: "membership_invite", entity_id: inviteId }),
  });
  redirect(`/app/members?tenant=${tenantId}&notice=Invitation%20sent`);
}

export async function setMemberStatusAction(formData: FormData) {
  const { getCurrentUser, supabaseRequest } = await import("@/lib/supabase/auth");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const tenantId = value(formData, "tenant_id");
  const membershipId = value(formData, "membership_id");
  const status = value(formData, "status");
  if (!/^[0-9a-f-]{36}$/i.test(tenantId) || !/^[0-9a-f-]{36}$/i.test(membershipId) || !["disabled", "revoked"].includes(status)) {
    redirect(`/app/members?tenant=${encodeURIComponent(tenantId)}&error=Invalid%20membership%20change`);
  }
  const target = await supabaseRequest<Array<{ user_id: string }>>(
    `/rest/v1/memberships?select=user_id&tenant_id=eq.${tenantId}&id=eq.${membershipId}&limit=1`,
  );
  if (!target.data?.[0]) redirect(`/app/members?tenant=${tenantId}&error=Membership%20not%20found`);
  if (target.data[0].user_id === user.id) redirect(`/app/members?tenant=${tenantId}&error=You%20cannot%20disable%20or%20revoke%20your%20own%20membership`);
  const changed = await supabaseRequest<Array<{ id: string }>>(
    `/rest/v1/memberships?tenant_id=eq.${tenantId}&id=eq.${membershipId}`,
    { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status }) },
  );
  if (changed.error || !changed.data?.length) redirect(`/app/members?tenant=${tenantId}&error=This%20change%20was%20not%20allowed%20or%20could%20not%20be%20saved`);
  await supabaseRequest("/rest/v1/audit_events", {
    method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ tenant_id: tenantId, actor_id: user.id, action: `member.${status}`, entity_type: "membership", entity_id: membershipId }),
  });
  redirect(`/app/members?tenant=${tenantId}&notice=Member%20access%20updated`);
}

export async function revokeInviteAction(formData: FormData) {
  const { getCurrentUser, supabaseRequest } = await import("@/lib/supabase/auth");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const tenantId = value(formData, "tenant_id");
  const inviteId = value(formData, "invite_id");
  if (!/^[0-9a-f-]{36}$/i.test(tenantId) || !/^[0-9a-f-]{36}$/i.test(inviteId)) redirect("/app?error=Invalid%20invitation");
  const result = await supabaseRequest<Array<{ id: string }>>(
    `/rest/v1/membership_invites?id=eq.${inviteId}&tenant_id=eq.${tenantId}&status=eq.pending`,
    { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "revoked" }) },
  );
  if (result.error || !result.data?.length) redirect(`/app/members?tenant=${tenantId}&error=Invitation%20could%20not%20be%20revoked`);
  await supabaseRequest("/rest/v1/audit_events", {
    method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ tenant_id: tenantId, actor_id: user.id, action: "member.invitation_revoked", entity_type: "membership_invite", entity_id: inviteId }),
  });
  redirect(`/app/members?tenant=${tenantId}&notice=Invitation%20revoked`);
}

export async function signOutAction() {
  const { currentAccessToken } = await import("@/lib/supabase/auth");
  const accessToken = await currentAccessToken();
  const cfgUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cfgKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (accessToken && cfgUrl && cfgKey) {
    await fetch(`${cfgUrl.replace(/\/$/, "")}/auth/v1/logout`, {
      method: "POST",
      headers: { apikey: cfgKey, Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }).catch(() => undefined);
  }
  await clearAuthSession();
  redirect("/login?notice=You%20have%20signed%20out");
}
