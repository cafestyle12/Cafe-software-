"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { completeAuthSessionAction, verifyConfirmationAction } from "@/app/actions/auth";

type Props = { tokenHash: string; initialType: string; inviteId: string; initialError: string };

export function ConfirmationClient({ tokenHash, initialType, inviteId, initialError }: Props) {
  const [error, setError] = useState(initialError);
  const [working, setWorking] = useState(!initialError);
  const started = useRef(false);

  useEffect(() => {
    // Supabase OTP links are single-use. Prevent duplicate verification when effects
    // are re-run by React Strict Mode or a development refresh.
    if (started.current) return;
    started.current = true;

    if (initialError) {
      setWorking(false);
      return;
    }

    let type = initialType;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const hashType = hash.get("type");
    if (!type && hashType) type = hashType;

    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (accessToken && refreshToken && type) {
      // Remove sensitive tokens from the address bar before sending them to the server.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      void completeAuthSessionAction(accessToken, refreshToken, type, inviteId).catch(() => {
        setError("This link may have expired or already been used. Request a fresh email and open its newest link.");
        setWorking(false);
      });
      return;
    }

    if (tokenHash && type) {
      void verifyConfirmationAction(tokenHash, type, inviteId).catch(() => {
        setError("This link may have expired or already been used. Request a fresh email and open its newest link.");
        setWorking(false);
      });
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.has("code")) {
      setError("This email uses an unsupported confirmation format. Request a fresh CafeOS email and use the newest link.");
    } else {
      setError("No confirmation token was found. Open the newest link from your CafeOS email.");
    }
    setWorking(false);
  }, [initialError, initialType, inviteId, tokenHash]);

  return (
    <main className="auth-stage" style={{ minHeight: "100svh", display: "grid", placeItems: "center", padding: "28px 18px" }}>
      <section className="auth-card" style={{ width: "min(540px, 100%)" }}>
        <div className="card-topline"><span>CAFEOS ACCOUNT SECURITY</span><span className="sparkle">✦</span></div>
        <h1 style={{ margin: "20px 0 10px", font: "500 clamp(32px, 7vw, 43px)/1.08 Georgia, serif", letterSpacing: "-1.5px" }}>
          {working ? "Confirming your email." : "Let’s get you back on track."}
        </h1>
        {working && <p className="auth-subtitle">We’re securely verifying your link and preparing your CafeOS workspace. This should only take a moment.</p>}
        {!working && error && <p role="alert" className="auth-alert auth-error">{error}</p>}
        {!working && <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
          <Link href="/signup" className="auth-submit" style={{ textDecoration: "none" }}><span>Request a fresh confirmation email</span><span className="submit-arrow">↗</span></Link>
          <Link href="/forgot-password" className="auth-create" style={{ textDecoration: "none" }}>Reset password <span>→</span></Link>
          <Link href="/login" style={{ color: "var(--accent)", fontSize: 13, fontWeight: 700, marginTop: 5 }}>Back to sign in</Link>
        </div>}
        <p className="auth-footer">For your security, confirmation links can only be used once. <span>☕</span></p>
      </section>
    </main>
  );
}
