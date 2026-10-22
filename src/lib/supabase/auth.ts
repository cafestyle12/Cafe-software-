import "server-only";

import { cookies } from "next/headers";

const ACCESS_COOKIE = "cafeos_access_token";
const REFRESH_COOKIE = "cafeos_refresh_token";
const SESSION_VERSION_COOKIE = "cafeos_session_version";

type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: { full_name?: string; name?: string };
  app_metadata?: { cafeos_account_type?: string; must_change_password?: boolean; account_status?: string; session_version?: string };
};

type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  user?: AuthUser;
};
type AuthApiPayload = Partial<AuthSession> & { message?: string; msg?: string; error_description?: string };

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

export function authConfigured() {
  return Boolean(config());
}

function authHeaders(key: string, accessToken?: string): HeadersInit {
  return {
    apikey: key,
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

export async function currentAccessToken() {
  return (await cookies()).get(ACCESS_COOKIE)?.value ?? null;
}

export async function setAuthSession(session: AuthSession) {
  const jar = await cookies();
  const maxAge = Math.max(60, Math.min(session.expires_in ?? 3600, 60 * 60 * 24));
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
  jar.set(ACCESS_COOKIE, session.access_token, options);
  jar.set(REFRESH_COOKIE, session.refresh_token, {
    ...options,
    maxAge: 60 * 60 * 24 * 365,
  });
  if (session.user?.app_metadata?.session_version) {
    jar.set(SESSION_VERSION_COOKIE, session.user.app_metadata.session_version, { ...options, maxAge: 60 * 60 * 24 * 365 });
  } else {
    jar.set(SESSION_VERSION_COOKIE, "", { ...options, maxAge: 0 });
  }
}

export async function clearAuthSession() {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  jar.set(REFRESH_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  jar.set(SESSION_VERSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}

async function getUserWithToken(accessToken: string): Promise<AuthUser | null> {
  const cfg = config();
  if (!cfg) return null;
  const response = await fetch(`${cfg.url}/auth/v1/user`, {
    headers: authHeaders(cfg.key, accessToken),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as AuthUser;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const accessToken = await currentAccessToken();
  if (!accessToken) return null;
  return getUserWithToken(accessToken);
}

export async function supabaseRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ data: T | null; error: string | null; status: number }> {
  const cfg = config();
  const accessToken = await currentAccessToken();
  if (!cfg || !accessToken) return { data: null, error: "Authentication is required.", status: 401 };

  const response = await fetch(`${cfg.url}${path}`, {
    ...init,
    headers: {
      ...authHeaders(cfg.key, accessToken),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await response.text();
  let data: T | null = null;
  if (text) {
    try { data = JSON.parse(text) as T; } catch { data = null; }
  }
  if (!response.ok) {
    const body = data as { message?: string; msg?: string; error_description?: string } | null;
    return { data: null, error: body?.message ?? body?.msg ?? body?.error_description ?? "The request could not be completed.", status: response.status };
  }
  return { data, error: null, status: response.status };
}

export async function authApi(path: string, body: unknown) {
  const cfg = config();
  if (!cfg) return { ok: false as const, error: "CafeOS authentication is not configured yet." };
  const response = await fetch(`${cfg.url}${path}`, {
    method: "POST",
    headers: authHeaders(cfg.key),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await response.text();
  let payload: AuthApiPayload | null = null;
  if (text) {
    try { payload = JSON.parse(text) as AuthApiPayload; } catch { payload = null; }
  }
  if (!response.ok) {
    const raw = payload?.message ?? payload?.msg ?? payload?.error_description;
    const safeMessage = raw && /invalid login credentials/i.test(raw)
      ? "Email or password is incorrect."
      : raw && /already registered|already been registered/i.test(raw)
        ? "An account with this email may already exist. Try signing in."
        : "We could not complete that request. Check the details and try again.";
    return { ok: false as const, error: safeMessage, status: response.status };
  }
  return { ok: true as const, payload };
}

export function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const vercelHost = process.env.NEXT_PUBLIC_VERCEL_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (vercelHost) return (vercelHost.startsWith("http") ? vercelHost : `https://${vercelHost}`).replace(/\/$/, "");
  return process.env.NODE_ENV === "production" ? "" : "http://localhost:3000";
}
