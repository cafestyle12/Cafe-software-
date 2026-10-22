import { NextRequest, NextResponse } from "next/server";

const ACCESS_COOKIE = "cafeos_access_token";
const REFRESH_COOKIE = "cafeos_refresh_token";

type AuthUser = { id?: string; app_metadata?: { cafeos_account_type?: string; must_change_password?: boolean; account_status?: string; session_version?: string } };
type RestaurantAccount = { status: string; must_change_password: boolean; session_version: string };
type TokenClaims = { app_metadata?: { cafeos_account_type?: string; must_change_password?: boolean; account_status?: string; session_version?: string } };

function tokenClaims(token: string): TokenClaims | null {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="))) as TokenClaims;
  } catch {
    return null;
  }
}

function clearSessionRedirect(request: NextRequest, target: string) {
  const next = NextResponse.redirect(new URL(target, request.url));
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
  next.cookies.set(ACCESS_COOKIE, "", { ...options, maxAge: 0 });
  next.cookies.set(REFRESH_COOKIE, "", { ...options, maxAge: 0 });
  return next;
}

async function gate(request: NextRequest, response: NextResponse, user: AuthUser, accessToken: string, url: string) {
  const path = request.nextUrl.pathname;
  if (path.startsWith("/platform-admin")) return response;
  if (user.app_metadata?.cafeos_account_type !== "restaurant_owner" || !user.id) {
    return path === "/login" ? clearSessionRedirect(request, "/login?notice=Please%20sign%20in%20using%20your%20Restaurant%20ID") : clearSessionRedirect(request, "/login?notice=Please%20sign%20in%20using%20your%20Restaurant%20ID");
  }

  const claims = tokenClaims(accessToken);
  const tokenMeta = claims?.app_metadata;
  if (!tokenMeta || tokenMeta.cafeos_account_type !== "restaurant_owner") return clearSessionRedirect(request, "/login?notice=Your%20session%20is%20invalid.%20Sign%20in%20again");

  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return clearSessionRedirect(request, "/login?error=Restaurant%20authentication%20setup%20is%20incomplete");
  try {
    const lookup = await fetch(
      `${url}/rest/v1/restaurant_auth_accounts?select=status,must_change_password,session_version&auth_user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
      { headers: { apikey: secret, Authorization: `Bearer ${secret}` }, cache: "no-store" },
    );
    if (!lookup.ok) return clearSessionRedirect(request, "/login?error=Restaurant%20account%20could%20not%20be%20verified");
    const accounts = await lookup.json() as RestaurantAccount[];
    const account = accounts[0];
    if (!account) return clearSessionRedirect(request, "/login?error=Restaurant%20account%20is%20not%20provisioned");
    if (account.status !== "active" || user.app_metadata.account_status !== "active" || tokenMeta.account_status !== "active") {
      return clearSessionRedirect(request, "/login?error=This%20restaurant%20account%20is%20suspended%20or%20deactivated");
    }
    if (account.session_version !== user.app_metadata.session_version || account.session_version !== tokenMeta.session_version) {
      return clearSessionRedirect(request, "/login?notice=Your%20session%20was%20revoked.%20Sign%20in%20again");
    }
    if (account.must_change_password || user.app_metadata.must_change_password === true || tokenMeta.must_change_password === true) {
      if (!path.startsWith("/change-password")) return NextResponse.redirect(new URL("/change-password?first=1", request.url));
    }
    return response;
  } catch {
    // Fail closed if the authoritative restaurant account cannot be checked.
    return clearSessionRedirect(request, "/login?error=Restaurant%20account%20could%20not%20be%20verified");
  }
}

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  let response = NextResponse.next({ request });

  if (!url || !key || (!accessToken && !refreshToken)) return response;

  try {
    if (accessToken) {
      const check = await fetch(`${url}/auth/v1/user`, {
        headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      if (check.ok) return await gate(request, response, await check.json() as AuthUser, accessToken, url);
      if (!refreshToken || (check.status !== 401 && check.status !== 403)) return response;
    }
    if (!refreshToken) return response;

    const refreshed = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });
    if (!refreshed.ok) return clearSessionRedirect(request, "/login?notice=Your%20session%20expired.%20Sign%20in%20again");

    const session = await refreshed.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!session.access_token || !session.refresh_token) return clearSessionRedirect(request, "/login?notice=Your%20session%20expired.%20Sign%20in%20again");
    const userResponse = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    });
    if (!userResponse.ok) return clearSessionRedirect(request, "/login?notice=Your%20session%20expired.%20Sign%20in%20again");
    const user = await userResponse.json() as AuthUser;

    request.cookies.set(ACCESS_COOKIE, session.access_token);
    request.cookies.set(REFRESH_COOKIE, session.refresh_token);
    response = NextResponse.next({ request });
    const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
    response.cookies.set(ACCESS_COOKIE, session.access_token, { ...cookieOptions, maxAge: Math.max(60, session.expires_in ?? 3600) });
    response.cookies.set(REFRESH_COOKIE, session.refresh_token, { ...cookieOptions, maxAge: 60 * 60 * 24 * 365 });
    response.headers.set("Cache-Control", "private, no-store");
    return await gate(request, response, user, session.access_token, url);
  } catch {
    return clearSessionRedirect(request, "/login?error=Restaurant%20account%20could%20not%20be%20verified");
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
