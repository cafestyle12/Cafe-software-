import "server-only";

import { createHash } from "node:crypto";
import { generateInternalAuthEmail, generateRestaurantId, generateTemporaryPassword, normalizeRestaurantId } from "@/lib/restaurant-credentials";

export { generateInternalAuthEmail, generateRestaurantId, generateTemporaryPassword, normalizeRestaurantId };

export type RestaurantAccount = {
  tenant_id: string;
  restaurant_id: string;
  auth_user_id: string;
  auth_email: string;
  status: "active" | "suspended" | "deactivated";
  must_change_password: boolean;
};


export function adminConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && secret ? { url, secret } : null;
}

export async function adminFetch<T>(path: string, init: RequestInit = {}) {
  const config = adminConfig();
  if (!config) return { ok: false, status: 503, data: null as T | null };
  const response = await fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      apikey: config.secret,
      Authorization: `Bearer ${config.secret}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const raw = await response.text();
  let data: T | null = null;
  if (raw) {
    try { data = JSON.parse(raw) as T; } catch { data = null; }
  }
  return { ok: response.ok, status: response.status, data };
}

export function rateLimitKey(scope: string, value: string) {
  const salt = process.env.CAFEOS_RATE_LIMIT_SECRET || adminConfig()?.secret;
  if (!salt) throw new Error("Rate limiting is not configured");
  return createHash("sha256").update(`${salt}:${scope}:${value}`).digest("hex");
}

export async function consumeRestaurantLoginLimit(restaurantId: string, ip: string) {
  const keys = [rateLimitKey("restaurant", normalizeRestaurantId(restaurantId))];
  if (ip && ip !== "unknown") keys.push(rateLimitKey("ip", ip));
  const result = await adminFetch<Array<{ allowed: boolean; remaining: number; retry_after_seconds: number }>>(
    "/rest/v1/rpc/consume_cafeos_auth_attempts",
    { method: "POST", body: JSON.stringify({ p_key_hashes: keys }) },
  );
  return { ...result, keys, decision: result.data?.[0] };
}

export async function clearRestaurantLoginLimit(keys: string[]) {
  return adminFetch("/rest/v1/rpc/clear_cafeos_auth_attempts", {
    method: "POST",
    body: JSON.stringify({ p_key_hashes: keys }),
  });
}



