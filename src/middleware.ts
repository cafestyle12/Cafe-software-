import { NextRequest, NextResponse } from "next/server";

const ACCESS_COOKIE = "cafeos_access_token";
const REFRESH_COOKIE = "cafeos_refresh_token";
const SESSION_VERSION_COOKIE = "cafeos_session_version";

type AuthUser = {
  id?: string;
  app_metadata?: {
    cafeos_account_type?: string;
    must_change_password?: boolean;
    account_status?: string;
    session_version?: string;
  };
};

function jwtSessionVersion(token: string | undefined) {
  if (!token) return null;
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="))) as {
      app_metadata?: { session_version?: string };
    };
    return payload.app_metadata?.session_version ?? null;
  } catch {
    return null;
  }
}

function clearSession(request: NextRequest, target: string) {
  const response = NextResponse.redirect(new URL(target, request.url));
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 0 };
  response.cookies.set(ACCESS_COOKIE, "", options);
  response.cookies.set(REFRESH_COOKIE, "", options);
  response.cookies.set(SESSION_VERSION_COOKIE, "", options);
  return response;
}

function gate(request: NextRequest, response: NextResponse, user: AuthUser, token: string) {
  const path = request.nextUrl.pathname;
  const isLogin = path === "/login";
  if (path.startsWith("/platform-admin")) return response;

  if (user.app_metadata?.cafeos_account_type !== "restaurant_owner") {
    return isLogin ? response : clearSession(request, "/login?notice=Please%20sign%20in%20using%20your%20Restaurant%20ID");
  }

  // Supabase returns current user metadata while the JWT contains the claims
  // issued to that session. Reject stale/revoked versions rather than silently
  // refreshing an old session into a newly authorized one.
  const currentVersion = user.app_metadata.session_version;
  const tokenVersion = jwtSessionVersion(token);
  const cookieVersion = request.cookies.get(SESSION_VERSION_COOKIE)?.value;
  if (!currentVersion || !tokenVersion || tokenVersion !== currentVersion || cookieVersion !== currentVersion) {
    return clearSession(request, "/login?notice=Your%20session%20was%20revoked.%20Please%20sign%20in%20again");
  }

  if (user.app_metadata.account_status !== "active") {
    return clearSession(request, "/login?error=This%20restaurant%20account%20is%20suspended%20or%20deactivated");
  }
  if (user.app_metadata.must_change_password === true && !path.startsWith("/change-password")) {
    return NextResponse.redirect(new URL("/change-password?first=1", request.url));
  }
  if (user.app_metadata.must_change_password !== true && path.startsWith("/change-password") && request.nextUrl.searchParams.get("first") === "1") {
    return NextResponse.redirect(new URL("/app", request.url));
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path.startsWith("/t/") || path === "/api/public/table-session") {
    const publicResponse = NextResponse.next();
    publicResponse.headers.set("Cache-Control", "private, no-store");
    publicResponse.headers.set("Referrer-Policy", "no-referrer");
    publicResponse.headers.set("X-Content-Type-Options", "nosniff");
    publicResponse.headers.set("X-Frame-Options", "DENY");
    return publicResponse;
  }
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
      if (check.ok) {
        const user = await check.json() as AuthUser;
        return gate(request, response, user, accessToken);
      }
      if (!refreshToken || (check.status !== 401 && check.status !== 403)) return response;
    }
    if (!refreshToken) return response;

    const refreshed = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });
    if (!refreshed.ok) return clearSession(request, "/login?notice=Your%20session%20expired.%20Please%20sign%20in%20again");

    const session = await refreshed.json() as { access_token?: string; refresh_token?: string; expires_in?: number; user?: AuthUser };
    if (!session.access_token || !session.refresh_token) return clearSession(request, "/login?notice=Your%20session%20could%20not%20be%20refreshed");
    const userResponse = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    });
    if (!userResponse.ok) return clearSession(request, "/login?notice=Your%20session%20could%20not%20be%20verified");
    const user = await userResponse.json() as AuthUser;

    const currentVersion = user.app_metadata?.session_version;
    const tokenVersion = jwtSessionVersion(session.access_token);
    const cookieVersion = request.cookies.get(SESSION_VERSION_COOKIE)?.value;
    if (!currentVersion || !tokenVersion || tokenVersion !== currentVersion || cookieVersion !== currentVersion) {
      return clearSession(request, "/login?notice=Your%20session%20was%20revoked.%20Please%20sign%20in%20again");
    }

    request.cookies.set(ACCESS_COOKIE, session.access_token);
    request.cookies.set(REFRESH_COOKIE, session.refresh_token);
    response = NextResponse.next({ request });
    const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
    response.cookies.set(ACCESS_COOKIE, session.access_token, { ...cookieOptions, maxAge: Math.max(60, session.expires_in ?? 3600) });
    response.cookies.set(REFRESH_COOKIE, session.refresh_token, { ...cookieOptions, maxAge: 60 * 60 * 24 * 365 });
    response.cookies.set(SESSION_VERSION_COOKIE, currentVersion, { ...cookieOptions, maxAge: 60 * 60 * 24 * 365 });
    response.headers.set("Cache-Control", "private, no-store");
    return gate(request, response, user, session.access_token);
  } catch {
    // A transient auth network failure must not erase a valid browser session.
    return response;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
