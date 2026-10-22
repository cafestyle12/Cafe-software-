"use client";

import Link from "next/link";
import { signInAction } from "@/app/actions/auth";
import { authConfigured } from "@/lib/supabase/auth";
import { useState } from "react";

type Props = { searchParams: Promise<{ error?: string; notice?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const configured = authConfigured();

  return (
    <main className="auth-stage">
      <div className="auth-orb auth-orb-one" aria-hidden="true" />
      <div className="auth-orb auth-orb-two" aria-hidden="true" />
      <Link href="/" className="auth-brand"><span className="brand-mark">C</span><span>Cafe<span className="brand-accent">OS</span><small>YOUR CAFE. IN CONTROL.</small></span></Link>
      <div className="auth-layout">
        <section className="auth-story">
          <div className="eyebrow"><span className="live-dot" /> THE OPERATING SYSTEM FOR HOSPITALITY</div>
          <h1>Every great café<br />starts with <span>one good<br className="desktop-break" /> move.</span></h1>
          <p>Orders, teams, branches and the little details that make guests come back—beautifully connected in one workspace.</p>
          <div className="orbit-scene" aria-label="CafeOS connected workspace illustration">
            <div className="orbit orbit-a" /><div className="orbit orbit-b" />
            <div className="orbit-core"><span>☕</span><b>CafeOS</b><small>ONE CONNECTED CAFE</small></div>
            <div className="orbit-node node-orders"><span>↗</span><b>Orders</b></div>
            <div className="orbit-node node-team"><span>✳</span><b>Team</b></div>
            <div className="orbit-node node-sales"><span>₹</span><b>Sales</b></div>
            <div className="orbit-node node-menu"><span>▤</span><b>Menu</b></div>
          </div>
          <div className="trust-row"><span>✦ Made for modern cafés</span><span>⌁ Built to scale</span><span>◉ Workspace-level security</span></div>
        </section>
        <section className="auth-card-wrap">
          <div className="auth-card">
            <div className="card-topline"><span>WELCOME BACK</span><span className="sparkle">✦</span></div>
            <h2>Good to have<br />you back.</h2>
            <p className="auth-subtitle">Sign in to pick up where your café left off.</p>
            {params.error && <p role="alert" className="auth-alert auth-error">{params.error}</p>}
            {params.notice && <p role="status" className="auth-alert auth-success">{params.notice}</p>}
            {!configured && <p role="alert" className="auth-alert auth-warning">Authentication is not configured yet. Add the Supabase URL and publishable key.</p>}
            <form action={signInAction} className="auth-form">
              <label>Email address<span className="input-shell"><span aria-hidden="true">✉</span><input name="email" type="email" autoComplete="email" required maxLength={320} placeholder="you@yourcafe.com" /></span></label>
              <label>Password<span className="input-shell"><span aria-hidden="true">⌑</span><input name="password" type="password" autoComplete="current-password" required placeholder="Enter your password" /></span></label>
              <div className="auth-links"><Link href="/forgot-password">Forgot password?</Link></div>
              <button disabled={!configured} className="auth-submit"><span>Sign in to CafeOS</span><span className="submit-arrow">↗</span></button>
            </form>
            <div className="auth-divider"><span>NEW TO CAFEOS?</span></div>
            <Link href="/signup" className="auth-create">Create your workspace <span>→</span></Link>
            <p className="auth-privacy"><span>◈</span> Your workspace is protected by role-based access and database-level tenant isolation.</p>
          </div>
          <p className="auth-footer">A calmer shift starts here. <span>☕</span></p>
        </section>
      </div>
    </main>
  );
}
