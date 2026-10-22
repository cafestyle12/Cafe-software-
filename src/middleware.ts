import { NextRequest, NextResponse } from "next/server";

const ACCESS_COOKIE = "cafeos_access_token";
const REFRESH_COOKIE = "cafeos_refresh_token";

type AuthUser = { id?: string; app_metadata?: { cafeos_account_type?: string; must_change_password?: boolean; account_status?: string } };

function gate(request: NextRequest, response: NextResponse, user: AuthUser) {
  const path = request.nextUrl.pathname;
  const isLogin = path === "/login";
  const isPlatformAdmin = path.startsWith("/platform-admin");
  if (isPlatformAdmin) return response;

  const clear = (target: string) => {
    const next = NextResponse.redirect(new URL(target, request.url));
    next.cookies.set(ACCESS_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
    next.cookies.set(REFRESH_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
    return next;
  };

  if (user.app_metadata?.cafeos_account_type !== "restaurant_owner") {
    return isLogin ? response : clear("/login?notice=Please%20sign%20in%20using%20your%20Restaurant%20ID");
  }
  if (user.app_metadata.account_status && user.app_metadata.account_status !== "active") {
    return clear("/login?error=This%20restaurant%20account%20is%20suspended%20or%20deactivated");
  }
  if (user.app_metadata.must_change_password === true && !path.startsWith("/change-password")) {
    return NextResponse.redirect(new URL("/change-password?first=1", request.url));
  }
  if (user.app_metadata.must_change_password !== true && path.startsWith("/change-password?first=1")) {
    return NextResponse.redirect(new URL("/app", request.url));
  }
  return response;
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
      if (check.ok) {
        const user = await check.json() as AuthUser;
        return gate(request, response, user);
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
    if (!refreshed.ok) {
      response.cookies.set(ACCESS_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
      response.cookies.set(REFRESH_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
      return response;
    }

    const session = await refreshed.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!session.access_token || !session.refresh_token) return response;
    const userResponse = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    });
    if (!userResponse.ok) return response;
    const user = await userResponse.json() as AuthUser;

    request.cookies.set(ACCESS_COOKIE, session.access_token);
    request.cookies.set(REFRESH_COOKIE, session.refresh_token);
    response = NextResponse.next({ request });
    const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
    response.cookies.set(ACCESS_COOKIE, session.access_token, { ...cookieOptions, maxAge: Math.max(60, session.expires_in ?? 3600) });
    response.cookies.set(REFRESH_COOKIE, session.refresh_token, { ...cookieOptions, maxAge: 60 * 60 * 24 * 365 });
    response.headers.set("Cache-Control", "private, no-store");
    return gate(request, response, user);
  } catch {
    // A transient auth network failure must not erase a valid browser session.
    return response;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
