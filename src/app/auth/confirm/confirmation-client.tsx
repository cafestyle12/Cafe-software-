"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { completeAuthSessionAction, verifyConfirmationAction } from "@/app/actions/auth";

type Props = { tokenHash: string; initialType: string; initialError: string };

export function ConfirmationClient({ tokenHash, initialType, initialError }: Props) {
  const [error, setError] = useState(initialError);
  const [working, setWorking] = useState(!initialError);

  useEffect(() => {
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
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      void completeAuthSessionAction(accessToken, refreshToken, type).catch(() => {
        setError("This confirmation link is invalid or expired. Request a fresh link and try again.");
        setWorking(false);
      });
      return;
    }
    if (tokenHash && type) {
      void verifyConfirmationAction(tokenHash, type).catch(() => {
        setError("This confirmation link is invalid or expired. Request a fresh link and try again.");
        setWorking(false);
      });
      return;
    }
    setError("No valid confirmation token was found. Open the latest link from your email.");
    setWorking(false);
  }, [initialError, initialType, tokenHash]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-8 text-xl font-bold tracking-tight">Cafe<span className="text-[var(--accent)]">OS</span></Link>
      <section className="rounded-3xl border border-[var(--border)] bg-white p-7 shadow-sm sm:p-9">
        <h1 className="text-2xl font-semibold tracking-tight">{working ? "Verifying your link…" : "We couldn’t verify that link"}</h1>
        {working && <p className="mt-3 text-sm leading-6 text-[var(--muted)]">CafeOS is verifying the token with Supabase Auth and creating a secure session.</p>}
        {!working && error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {!working && <Link href="/login" className="mt-5 inline-block rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white">Back to sign in</Link>}
      </section>
    </main>
  );
}
