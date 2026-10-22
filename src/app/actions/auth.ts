"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { authApi, clearAuthSession, setAuthSession } from "@/lib/supabase/auth";
import { validateRestaurantPasswordChange } from "@/lib/restaurant-credentials";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
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

  const accounts = await adminFetch<Array<{ tenant_id: string; auth_user_id: string; auth_email: string; status: string; must_change_password: boolean; session_version: string }>>(
    `/rest/v1/restaurant_auth_accounts?select=tenant_id,auth_user_id,auth_email,status,must_change_password,session_version&restaurant_id=eq.${encodeURIComponent(restaurantId)}&limit=1`,
  );
  const account = accounts.data?.[0];
  if (!accounts.ok || !account || account.status !== "active") {
    redirect("/login?error=Invalid%20Restaurant%20ID%20or%20password");
  }

  const result = await authApi("/auth/v1/token?grant_type=password", { email: account.auth_email, password });
  const payload = result.ok ? result.payload : null;
  if (!payload) redirect("/login?error=Invalid%20Restaurant%20ID%20or%20password");
  const authMetadata = (payload.user as { app_metadata?: { cafeos_account_type?: string; account_status?: string; must_change_password?: boolean; session_version?: string } } | undefined)?.app_metadata;
  if (!payload.access_token || !payload.refresh_token || payload.user?.id !== account.auth_user_id || authMetadata?.cafeos_account_type !== "restaurant_owner" || authMetadata.account_status !== "active" || authMetadata.session_version !== account.session_version) {
    redirect("/login?error=Invalid%20Restaurant%20ID%20or%20password");
  }
  await clearRestaurantLoginLimit(limit.keys);
  await setAuthSession({ access_token: payload.access_token, refresh_token: payload.refresh_token, expires_in: payload.expires_in, user: payload.user });
  const appMetadata = (payload.user as { app_metadata?: { must_change_password?: boolean; account_status?: string } }).app_metadata;
  if (account.must_change_password || appMetadata?.must_change_password === true) redirect("/change-password?first=1");
  redirect("/app");
}





export async function changeRestaurantPasswordAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");
  const currentPassword = String(formData.get("current_password") ?? "");
  const firstLoginForm = String(formData.get("first_login") ?? "") === "1";
  const validationPrefix = firstLoginForm ? "/change-password?first=1&error=" : "/account-settings?error=";
  const passwordError = validateRestaurantPasswordChange(currentPassword, password, confirm);
  if (passwordError === "weak_password") redirect(validationPrefix + "Use%20a%2012%E2%80%93128%20character%20password%20with%20uppercase%2C%20lowercase%2C%20number%20and%20symbol");
  if (passwordError === "password_mismatch") redirect(validationPrefix + "New%20passwords%20do%20not%20match");
  if (passwordError === "must_differ_from_current") redirect(validationPrefix + "Enter%20your%20current%20password%20and%20choose%20a%20different%20new%20password");

  const { getCurrentUser, currentAccessToken } = await import("@/lib/supabase/auth");
  const { adminFetch } = await import("@/lib/supabase/restaurant-auth");
  const user = await getCurrentUser();
  const accessToken = await currentAccessToken();
  if (!user || !accessToken) redirect("/login?error=Please%20sign%20in%20again");

  const cfgUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const cfgKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!cfgUrl || !cfgKey) redirect("/change-password?error=Authentication%20is%20not%20configured");

  const accounts = await adminFetch<Array<{ auth_email: string; status: string; must_change_password: boolean; session_version: string }>>(
    `/rest/v1/restaurant_auth_accounts?select=auth_email,status,must_change_password,session_version&auth_user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
  );
  const account = accounts.data?.[0];
  if (!accounts.ok || !account || account.status !== "active") redirect("/login?error=Account%20is%20unavailable");

  const appMetadata = (user as { app_metadata?: { must_change_password?: boolean; account_status?: string; cafeos_account_type?: string; session_version?: string } }).app_metadata ?? {};
  if (appMetadata.cafeos_account_type !== "restaurant_owner") redirect("/login?error=Account%20is%20unavailable");

  const reauth = await authApi("/auth/v1/token?grant_type=password", { email: account.auth_email, password: currentPassword });
  if (!reauth.ok || !reauth.payload || reauth.payload.user?.id !== user.id || (reauth.payload.user as { app_metadata?: { session_version?: string } }).app_metadata?.session_version !== account.session_version) {
    redirect("/change-password?error=Current%20password%20is%20incorrect%20or%20the%20account%20needs%20administrator%20repair");
  }

  if (account.must_change_password && appMetadata.must_change_password !== true) {
    const lockedMetadata = await adminFetch(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
      method: "PUT",
      body: JSON.stringify({ app_metadata: { ...appMetadata, must_change_password: true, account_status: "active" } }),
    });
    if (!lockedMetadata.ok) redirect("/change-password?error=Could%20not%20securely%20prepare%20the%20first-login%20password%20change.%20Please%20retry");
    await fetch(`${cfgUrl}/auth/v1/logout?scope=global`, {
      method: "POST", headers: { apikey: cfgKey, Authorization: `Bearer ${accessToken}` }, cache: "no-store",
    }).catch(() => null);
    await clearAuthSession();
    redirect("/login?notice=Security%20state%20was%20updated.%20Sign%20in%20again%20to%20change%20your%20temporary%20password");
  }

  const sessionVersion = randomUUID();
  // Lock and rotate the database session version first, invalidating existing
  // JWTs before the password is changed. All partial failures remain deny-only.
  const locked = await adminFetch<Array<{ tenant_id: string }>>(
    `/rest/v1/restaurant_auth_accounts?auth_user_id=eq.${encodeURIComponent(user.id)}`,
    { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ must_change_password: true, session_version: sessionVersion, updated_at: new Date().toISOString() }) },
  );
  if (!locked.ok || !locked.data?.length) redirect("/change-password?error=Could%20not%20securely%20lock%20the%20account%20for%20password%20change");

  const updated = await adminFetch(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
    method: "PUT",
    body: JSON.stringify({ password, app_metadata: { ...appMetadata, must_change_password: true, account_status: "active", session_version: sessionVersion } }),
  });
  if (!updated.ok) {
    await adminFetch(`/rest/v1/restaurant_auth_accounts?auth_user_id=eq.${encodeURIComponent(user.id)}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ must_change_password: true, session_version: account.session_version, updated_at: new Date().toISOString() }),
    });
    redirect("/change-password?error=Password%20update%20failed.%20The%20account%20remains%20locked%20until%20you%20retry");
  }

  const profileUpdate = await adminFetch<Array<{ tenant_id: string }>>(
    `/rest/v1/restaurant_auth_accounts?auth_user_id=eq.${encodeURIComponent(user.id)}`,
    { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ must_change_password: false, session_version: sessionVersion, password_changed_at: new Date().toISOString(), updated_at: new Date().toISOString() }) },
  );
  if (!profileUpdate.ok || !profileUpdate.data?.length) {
    redirect("/change-password?error=Password%20changed%20but%20the%20account%20remains%20locked.%20Retry%20or%20contact%20CafeOS%20support");
  }

  const unlockedMetadata = await adminFetch(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
    method: "PUT",
    body: JSON.stringify({ app_metadata: { ...appMetadata, must_change_password: false, account_status: "active", session_version: sessionVersion } }),
  });
  if (!unlockedMetadata.ok) {
    await adminFetch(`/rest/v1/restaurant_auth_accounts?auth_user_id=eq.${encodeURIComponent(user.id)}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ must_change_password: true, session_version: sessionVersion, updated_at: new Date().toISOString() }),
    });
    redirect("/change-password?error=Password%20changed%20but%20activation%20is%20pending.%20Retry%20or%20contact%20CafeOS%20support");
  }

  await fetch(`${cfgUrl}/auth/v1/logout?scope=global`, {
    method: "POST", headers: { apikey: cfgKey, Authorization: `Bearer ${accessToken}` }, cache: "no-store",
  }).catch(() => null);
  await clearAuthSession();
  redirect("/login?notice=Password%20updated.%20Please%20sign%20in%20with%20your%20new%20password");
}

export async function inviteMemberAction(formData: FormData) {
  void formData;
  redirect("/app/members?error=Email-based%20member%20invitation%20is%20disabled%20in%20Restaurant%20ID%20authentication.%20Use%20platform-admin%20provisioning%20instead");
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
