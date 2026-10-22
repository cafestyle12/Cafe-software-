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
  const email = value(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!emailIsValid(email) || password.length < 1) redirect("/login?error=Enter%20a%20valid%20email%20and%20password");
  const attempt = await consumeAuthAttempt("login");
  if (!attempt.allowed) redirect("/login?error=You%20have%20used%205%20login%20attempts.%20Please%20wait%2015%20minutes%20before%20trying%20again");
  const result = await authApi("/auth/v1/token?grant_type=password", { email, password });
  if (!result.ok) {
    const suffix = attempt.remaining > 0 ? " " + attempt.remaining + " attempt(s) remaining before a 15-minute cooldown." : " No attempts remain; wait 15 minutes before trying again.";
    redirect("/login?error=" + encodeURIComponent(result.error + suffix));
  }
  if (!result.payload?.access_token || !result.payload.refresh_token) redirect("/login?error=Sign-in%20could%20not%20start%20a%20session");
  await clearAuthAttempts("login");
  await setAuthSession({ access_token: result.payload.access_token, refresh_token: result.payload.refresh_token, expires_in: result.payload.expires_in, user: result.payload.user });
  redirect("/app");
}

export async function signUpAction(formData: FormData) {
  const name = value(formData, "full_name");
  const email = value(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (name.length < 2 || name.length > 120 || !emailIsValid(email) || password.length < 10) {
    redirect("/signup?error=Enter%20your%20name%2C%20a%20valid%20email%2C%20and%20a%20password%20of%20at%20least%2010%20characters");
  }
  const attempt = await consumeAuthAttempt("signup");
  if (!attempt.allowed) redirect("/signup?error=You%20have%20used%205%20account%20creation%20attempts.%20Please%20wait%2015%20minutes%20before%20trying%20again");
  const baseUrl = siteUrl();
  if (!baseUrl) redirect("/signup?error=The%20site%20URL%20is%20not%20configured");
  const redirectTo = `${baseUrl}/auth/confirm`;
  const result = await authApi(`/auth/v1/signup?redirect_to=${encodeURIComponent(redirectTo)}`, {
    email,
    password,
    data: { full_name: name },
  });
  if (!result.ok) {
    const suffix = attempt.remaining > 0 ? " " + attempt.remaining + " attempt(s) remaining before a 15-minute cooldown." : " No attempts remain; wait 15 minutes before trying again.";
    redirect(`/signup?error=${encodeURIComponent(result.error + suffix)}`);
  }
  // Supabase can return HTTP 200 for a repeated signup without sending a new email.
  // An empty identities array is its documented signal that this email already exists.
  const signupUser = result.payload?.user as ({ identities?: unknown[] } | undefined);
  if (signupUser?.identities?.length === 0) {
    redirect("/signup?notice=An%20account%20may%20already%20exist%20for%20this%20email.%20Use%20Resend%20confirmation%20below%20instead%20of%20creating%20it%20again.%20If%20no%20email%20arrives%2C%20the%20Supabase%20email%20provider%20needs%20configuration");
  }
  await clearAuthAttempts("signup");
  if (result.payload?.access_token && result.payload.refresh_token) {
    await setAuthSession({ access_token: result.payload.access_token, refresh_token: result.payload.refresh_token, expires_in: result.payload.expires_in, user: result.payload.user });
    redirect("/welcome");
  }
  redirect("/signup?notice=Account%20request%20received.%20If%20the%20confirmation%20email%20does%20not%20arrive%20within%20a%20few%20minutes%2C%20check%20spam%20and%20promotions%2C%20then%20use%20Resend%20confirmation.%20If%20it%20still%20does%20not%20arrive%2C%20the%20CafeOS%20email%20provider%20needs%20configuration");
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = value(formData, "email").toLowerCase();
  if (!emailIsValid(email)) redirect("/forgot-password?error=Enter%20a%20valid%20email%20address");
  const cfgUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cfgKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const baseUrl = siteUrl();
  if (!cfgUrl || !cfgKey || !baseUrl) redirect("/forgot-password?error=Authentication%20redirect%20is%20not%20configured");
  const response = await fetch(`${cfgUrl.replace(/\/$/, "")}/auth/v1/recover?redirect_to=${encodeURIComponent(baseUrl + "/auth/confirm")}`, {
    method: "POST",
    headers: { apikey: cfgKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    cache: "no-store",
  });
  if (!response.ok) {
    const details = await response.json().catch(() => ({})) as { msg?: string; message?: string; error_code?: string };
    if (response.status === 429 || details.error_code === "over_email_send_rate_limit") redirect("/forgot-password?error=Email%20provider%20rate%20limit%20reached.%20Wait%20a%20few%20minutes%20before%20retrying");
    redirect("/forgot-password?error=Email%20could%20not%20be%20sent.%20Check%20Supabase%20SMTP%20settings%2C%20sender%20verification%2C%20and%20Auth%20logs");
  }
  redirect("/forgot-password?sent=1");
}

export async function updatePasswordAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");
  if (password.length < 10 || password !== confirm) redirect("/reset-password?error=Passwords%20must%20match%20and%20contain%20at%20least%2010%20characters");
  const cfgUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cfgKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const { currentAccessToken } = await import("@/lib/supabase/auth");
  const accessToken = await currentAccessToken();
  if (!cfgUrl || !cfgKey || !accessToken) redirect("/login?error=Your%20recovery%20session%20expired.%20Request%20a%20new%20link");
  const response = await fetch(`${cfgUrl.replace(/\/$/, "")}/auth/v1/user`, {
    method: "PUT",
    headers: { apikey: cfgKey, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
    cache: "no-store",
  });
  if (!response.ok) redirect("/reset-password?error=Password%20could%20not%20be%20updated.%20Request%20a%20new%20recovery%20link");
  redirect("/app?passwordUpdated=1");
}

export async function completeAuthSessionAction(accessToken: string, refreshToken: string, type: string, inviteId = "") {
  const allowedTypes = new Set(["signup", "email", "recovery", "invite", "magiclink"]);
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
  redirect(type === "recovery" ? "/reset-password" : type === "invite" ? "/app?inviteAccepted=1" : type === "signup" || type === "email" ? "/welcome" : "/onboarding");
}

export async function verifyConfirmationAction(tokenHash: string, type: string, inviteId = "") {
  const allowedTypes = new Set(["signup", "email", "recovery", "invite", "magiclink"]);
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
    redirect(type === "recovery" ? "/reset-password" : type === "invite" ? "/app?inviteAccepted=1" : type === "signup" || type === "email" ? "/welcome" : "/onboarding");
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
