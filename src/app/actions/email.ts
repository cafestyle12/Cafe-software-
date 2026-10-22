"use server";

import { redirect } from "next/navigation";
import { siteUrl } from "@/lib/supabase/auth";

function emailIsValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;
}

export async function resendConfirmationAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!emailIsValid(email)) {
    redirect("/signup?resendError=Enter%20a%20valid%20email%20address");
  }

  const baseUrl = siteUrl();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!baseUrl || !url || !key) {
    redirect("/signup?resendError=Email%20confirmation%20is%20not%20configured");
  }

  const query = new URLSearchParams({
    type: "signup",
    redirect_to: `${baseUrl}/auth/confirm`,
  });
  const response = await fetch(`${url}/auth/v1/resend?${query.toString()}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as {
      msg?: string;
      message?: string;
      error_description?: string;
      error_code?: string;
    };
    if (response.status === 429 || payload.error_code === "over_email_send_rate_limit") {
      redirect("/signup?resendError=Email%20limit%20reached.%20Wait%20a%20few%20minutes%20before%20trying%20again");
    }
    redirect("/signup?resendError=Email%20could%20not%20be%20sent.%20Check%20Supabase%20SMTP%20settings%2C%20verified%20sender%2C%20and%20Auth%20logs");
  }

  redirect("/signup?resendSent=1");
}
