"use server";

import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { generateTemporaryPassword } from "@/lib/restaurant-credentials";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  adminFetch,
  generateInternalAuthEmail,
} from "@/lib/supabase/restaurant-auth";

const ADMIN_COOKIE = "cafeos_platform_admin";
const ADMIN_SESSION_SECONDS = 60 * 60;

function constantTimeEqual(a: string, b: string) {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

async function requirePlatformAdmin() {
  const expected = process.env.CAFEOS_PLATFORM_ADMIN_TOKEN;
  const jar = await cookies();
  const actual = jar.get(ADMIN_COOKIE)?.value ?? "";
  return Boolean(expected && actual && constantTimeEqual(actual, expected));
}

export async function loginPlatformAdminAction(formData: FormData) {
  const expected = process.env.CAFEOS_PLATFORM_ADMIN_TOKEN;
  const provided = String(formData.get("admin_token") ?? "");
  if (!expected || expected.length < 10) {
    redirect("/platform-admin?error=Platform%20admin%20is%20not%20configured.%20Set%20a%20at%20least%2010%20characters%20for%20CAFEOS_PLATFORM_ADMIN_TOKEN%20in%20Vercel%20environment");
  }
  const { headers } = await import("next/headers");
  const { consumeRestaurantLoginLimit, clearRestaurantLoginLimit } = await import("@/lib/supabase/restaurant-auth");
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-real-ip") ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await consumeRestaurantLoginLimit("PLATFORM_ADMIN", ip);
  if (!limit.ok || !limit.decision) {
    redirect("/platform-admin?error=Administrator%20sign-in%20is%20temporarily%20unavailable");
  }
  if (!limit.decision.allowed) {
    redirect("/platform-admin?error=Too%20many%20attempts.%20Wait%2015%20minutes%20before%20trying%20again");
  }
  if (!provided || !constantTimeEqual(provided, expected)) {
    redirect("/platform-admin?error=Invalid%20administrator%20credentials");
  }
  await clearRestaurantLoginLimit(limit.keys);
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/platform-admin",
    maxAge: ADMIN_SESSION_SECONDS,
  });
  redirect("/platform-admin");
}

export async function logoutPlatformAdminAction() {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/platform-admin", maxAge: 0 });
  redirect("/platform-admin");
}

export type ProvisionState = {
  error?: string;
  credentials?: { restaurantId: string; temporaryPassword: string; restaurantName: string };
};

export async function provisionRestaurantAction(_previous: ProvisionState, formData: FormData): Promise<ProvisionState> {
  if (!(await requirePlatformAdmin())) return { error: "Administrator session expired. Sign in again." };
  const restaurantName = String(formData.get("restaurant_name") ?? "").trim();
  const branchName = String(formData.get("branch_name") ?? "").trim();
  const ownerName = String(formData.get("owner_name") ?? "").trim();
  const restaurantId = String(formData.get("restaurant_id") ?? "").trim().toUpperCase();
  const temporaryPassword = String(formData.get("initial_password") ?? "");
  if (restaurantName.length < 2 || restaurantName.length > 120 || branchName.length < 2 || branchName.length > 120 || ownerName.length < 2 || ownerName.length > 120) {
    return { error: "Enter a restaurant name, first branch name, and owner name (2–120 characters each)." };
  }

  if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(restaurantId)) {
    return { error: "Restaurant ID must be 3–32 letters, numbers, hyphens or underscores, starting with a letter or number." };
  }
  if (temporaryPassword.length < 12 || temporaryPassword.length > 128 || !/[a-z]/.test(temporaryPassword) || !/[A-Z]/.test(temporaryPassword) || !/[0-9]/.test(temporaryPassword) || !/[^A-Za-z0-9]/.test(temporaryPassword)) {
    return { error: "Initial password must be 12–128 characters and include uppercase, lowercase, number and symbol." };
  }
  const authEmail = generateInternalAuthEmail();
  const sessionVersion = randomUUID();
  const slugBase = restaurantName.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 55) || "restaurant";
  const slug = `${slugBase}-${createHash("sha256").update(restaurantId).digest("hex").slice(0, 8)}`;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return { error: "Server-side Supabase secret is missing. Set SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY in Vercel Preview; never use NEXT_PUBLIC_." };

  const created = await adminFetch<{ id?: string; email?: string; app_metadata?: Record<string, unknown>; user?: { id?: string } }>("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email: authEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name: ownerName },
      app_metadata: { cafeos_account_type: "restaurant_owner", must_change_password: true, account_status: "active", session_version: sessionVersion },
    }),
  });
  const authUserId = created.data?.id ?? created.data?.user?.id;
  if (!created.ok || !authUserId) {
    return { error: "Supabase could not create the owner identity. Check the server-side key and Auth logs; no credentials were issued." };
  }

  const provisioned = await adminFetch<Array<{ tenant_id: string; branch_id: string }>>("/rest/v1/rpc/admin_provision_restaurant", {
    method: "POST",
    body: JSON.stringify({
      p_restaurant_id: restaurantId,
      p_auth_user_id: authUserId,
      p_auth_email: authEmail,
      p_name: restaurantName,
      p_slug: slug,
      p_branch_name: branchName,
      p_display_name: ownerName,
      p_session_version: sessionVersion,
    }),
  });
  if (!provisioned.ok || !provisioned.data?.length) {
    await adminFetch(`/auth/v1/admin/users/${encodeURIComponent(authUserId)}`, { method: "DELETE" });
    return { error: "Restaurant provisioning failed. The temporary Auth identity was rolled back; check migration status and database logs." };
  }

  return { credentials: { restaurantId, temporaryPassword, restaurantName } };
}

export type ResetPasswordState = {
  error?: string;
  credentials?: { restaurantId: string; password: string };
};

export async function resetRestaurantPasswordAction(_previous: ResetPasswordState, formData: FormData): Promise<ResetPasswordState> {
  if (!(await requirePlatformAdmin())) return { error: "Administrator session expired. Sign in again." };
  const restaurantId = String(formData.get("restaurant_id") ?? "").trim().toUpperCase();
  const accounts = await adminFetch<Array<{ tenant_id: string; auth_user_id: string; status: string }>>(
    `/rest/v1/restaurant_auth_accounts?select=tenant_id,auth_user_id,status&restaurant_id=eq.${encodeURIComponent(restaurantId)}&limit=1`,
  );
  const account = accounts.data?.[0];
  if (!accounts.ok || !account || account.status === "deactivated") return { error: "Restaurant account was not found or is deactivated." };
  const password = generateTemporaryPassword();
  const sessionVersion = randomUUID();
  const locked = await adminFetch<Array<{ tenant_id: string }>>(
    `/rest/v1/restaurant_auth_accounts?auth_user_id=eq.${encodeURIComponent(account.auth_user_id)}`,
    { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ must_change_password: true, credential_reset_at: new Date().toISOString(), session_version: sessionVersion, updated_at: new Date().toISOString() }) },
  );
  if (!locked.ok || !locked.data?.length) return { error: "Could not lock the account for credential reset." };
  const user = await adminFetch<{ app_metadata?: Record<string, unknown>; user?: { app_metadata?: Record<string, unknown> } }>(`/auth/v1/admin/users/${encodeURIComponent(account.auth_user_id)}`);
  if (!user.ok || !user.data) return { error: "Account is safely locked, but Auth metadata could not be read. Retry after checking the Supabase secret." };
  const updated = await adminFetch(`/auth/v1/admin/users/${encodeURIComponent(account.auth_user_id)}`, {
    method: "PUT",
    body: JSON.stringify({ password, app_metadata: { ...(user.data?.user?.app_metadata ?? user.data?.app_metadata ?? {}), must_change_password: true, account_status: account.status, cafeos_account_type: "restaurant_owner", session_version: sessionVersion } }),
  });
  if (!updated.ok) return { error: "Account is locked for safety but password reset failed. Retry the reset." };
  await adminFetch("/rest/v1/audit_events", {
    method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ tenant_id: account.tenant_id, actor_id: null, action: "platform.credentials_reset", entity_type: "restaurant_auth_account", entity_id: restaurantId }),
  });
  return { credentials: { restaurantId, password } };
}
export async function changeRestaurantStatusAction(formData: FormData) {
  if (!(await requirePlatformAdmin())) redirect("/platform-admin?error=Administrator%20session%20expired");
  const restaurantId = String(formData.get("restaurant_id") ?? "").trim().toUpperCase();
  const status = String(formData.get("status") ?? "");
  if (!["active", "suspended", "deactivated"].includes(status)) redirect("/platform-admin?error=Invalid%20account%20status");
  const accounts = await adminFetch<Array<{ tenant_id: string; auth_user_id: string; status: string }>>(
    `/rest/v1/restaurant_auth_accounts?select=tenant_id,auth_user_id,status&restaurant_id=eq.${encodeURIComponent(restaurantId)}&limit=1`,
  );
  const account = accounts.data?.[0];
  if (!accounts.ok || !account) redirect("/platform-admin?error=Restaurant%20account%20was%20not%20found");
  const sessionVersion = randomUUID();
  const changed = await adminFetch<Array<{ tenant_id: string }>>("/rest/v1/rpc/admin_set_restaurant_status", {
    method: "POST", body: JSON.stringify({ p_tenant_id: account.tenant_id, p_status: status, p_session_version: sessionVersion }),
  });
  if (!changed.ok) redirect("/platform-admin?error=Could%20not%20update%20restaurant%20status.%20Confirm%20the%20migration%20is%20applied");
  const user = await adminFetch<{ app_metadata?: Record<string, unknown>; user?: { app_metadata?: Record<string, unknown> } }>(`/auth/v1/admin/users/${encodeURIComponent(account.auth_user_id)}`);
  if (!user.ok || !user.data) redirect("/platform-admin?error=Database%20status%20updated%20but%20Auth%20metadata%20could%20not%20be%20read.%20RLS%20still%20blocks%20inactive%20tenants");
  const metaStatus = status === "active" ? "active" : status;
  const appMetadata = user.data.user?.app_metadata ?? user.data.app_metadata ?? {};
  const meta = await adminFetch(`/auth/v1/admin/users/${encodeURIComponent(account.auth_user_id)}`, {
    method: "PUT", body: JSON.stringify({ app_metadata: { ...appMetadata, cafeos_account_type: "restaurant_owner", account_status: metaStatus, session_version: sessionVersion } }),
  });
  await adminFetch("/rest/v1/audit_events", {
    method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ tenant_id: account.tenant_id, actor_id: null, action: `platform.restaurant_${status}`, entity_type: "restaurant_auth_account", entity_id: restaurantId }),
  });
  if (!meta.ok) redirect("/platform-admin?error=Database%20status%20updated%20but%20Auth%20metadata%20refresh%20failed.%20RLS%20still%20blocks%20suspended%20tenant%20access");
  redirect("/platform-admin?notice=Restaurant%20status%20updated");
}
