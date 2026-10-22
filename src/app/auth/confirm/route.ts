import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const allowedTypes = new Set(["signup", "email", "recovery", "invite", "magiclink"]);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!tokenHash || !type || !allowedTypes.has(type) || !url || !key) {
    return NextResponse.redirect(new URL("/login?error=This%20confirmation%20link%20is%20invalid%20or%20expired", request.url));
  }

  try {
    const result = await fetch(`${url}/auth/v1/verify`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ token_hash: tokenHash, type }),
      cache: "no-store",
    });
    if (!result.ok) {
      return NextResponse.redirect(new URL("/login?error=This%20confirmation%20link%20is%20invalid%20or%20expired", request.url));
    }
    const session = (await result.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!session.access_token || !session.refresh_token) {
      return NextResponse.redirect(new URL("/login?notice=Email%20confirmed.%20You%20can%20now%20sign%20in", request.url));
    }

    const destination = type === "recovery" ? "/reset-password" : "/onboarding";
    const response = NextResponse.redirect(new URL(destination, request.url));
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    };
    response.cookies.set("cafeos_access_token", session.access_token, { ...options, maxAge: Math.max(60, session.expires_in ?? 3600) });
    response.cookies.set("cafeos_refresh_token", session.refresh_token, { ...options, maxAge: 60 * 60 * 24 * 30 });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return NextResponse.redirect(new URL("/login?error=Unable%20to%20verify%20the%20link.%20Please%20try%20again", request.url));
  }
}
