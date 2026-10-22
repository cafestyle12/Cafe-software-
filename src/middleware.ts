import { NextRequest, NextResponse } from "next/server";

const ACCESS_COOKIE = "cafeos_access_token";
const REFRESH_COOKIE = "cafeos_refresh_token";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  let response = NextResponse.next({ request });

  if (!url || !key || !accessToken) return response;

  try {
    const check = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (check.ok || !refreshToken || (check.status !== 401 && check.status !== 403)) return response;

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

    const session = (await refreshed.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!session.access_token || !session.refresh_token) return response;

    request.cookies.set(ACCESS_COOKIE, session.access_token);
    request.cookies.set(REFRESH_COOKIE, session.refresh_token);
    response = NextResponse.next({ request });
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    };
    response.cookies.set(ACCESS_COOKIE, session.access_token, { ...cookieOptions, maxAge: Math.max(60, session.expires_in ?? 3600) });
    response.cookies.set(REFRESH_COOKIE, session.refresh_token, { ...cookieOptions, maxAge: 60 * 60 * 24 * 365 });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    // A transient auth network failure must not erase a valid browser session.
    return response;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
