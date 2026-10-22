"use server";

import { redirect } from "next/navigation";
import { authApi, clearAuthSession, setAuthSession, siteUrl } from "@/lib/supabase/auth";

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
  const result = await authApi("/auth/v1/token?grant_type=password", { email, password });
  if (!result.ok) redirect(`/login?error=${encodeURIComponent(result.error)}`);
  if (!result.payload?.access_token || !result.payload.refresh_token) redirect("/login?error=Sign-in%20could%20not%20start%20a%20session");
  await setAuthSession(result.payload);
  redirect("/app");
}

export async function signUpAction(formData: FormData) {
  const name = value(formData, "full_name");
  const email = value(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (name.length < 2 || name.length > 120 || !emailIsValid(email) || password.length < 10) {
    redirect("/signup?error=Enter%20your%20name%2C%20a%20valid%20email%2C%20and%20a%20password%20of%20at%20least%2010%20characters");
  }
  const redirectTo = `${siteUrl()}/auth/confirm`;
  const result = await authApi(`/auth/v1/signup?redirect_to=${encodeURIComponent(redirectTo)}`, {
    email,
    password,
    data: { full_name: name },
  });
  if (!result.ok) redirect(`/signup?error=${encodeURIComponent(result.error)}`);
  if (result.payload?.access_token && result.payload.refresh_token) {
    await setAuthSession(result.payload);
    redirect("/onboarding");
  }
  redirect("/login?notice=Check%20your%20email%20to%20confirm%20your%20CafeOS%20account%20before%20signing%20in");
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = value(formData, "email").toLowerCase();
  if (!emailIsValid(email)) redirect("/forgot-password?error=Enter%20a%20valid%20email%20address");
  const cfgUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cfgKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!cfgUrl || !cfgKey) redirect("/forgot-password?error=Authentication%20is%20not%20configured");
  const response = await fetch(`${cfgUrl.replace(/\/$/, "")}/auth/v1/recover?redirect_to=${encodeURIComponent(siteUrl() + "/auth/confirm")}`, {
    method: "POST",
    headers: { apikey: cfgKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    cache: "no-store",
  });
  if (!response.ok) redirect("/forgot-password?error=Could%20not%20send%20the%20recovery%20email.%20Try%20again%20later");
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
