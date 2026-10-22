import Link from "next/link";
import { redirect } from "next/navigation";
import { signInAction } from "@/app/actions/auth";
import { authConfigured, getCurrentUser } from "@/lib/supabase/auth";
import { adminConfig } from "@/lib/supabase/restaurant-auth";
import { LoginShowcase } from "./login-showcase";
import { PasswordField } from "@/components/password-field";

type Props = { searchParams: Promise<{ error?: string; notice?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (user) {
    const meta = (user as { app_metadata?: { must_change_password?: boolean } }).app_metadata;
    redirect(meta?.must_change_password ? "/change-password?first=1" : "/app");
  }
  const params = await searchParams;
  const configured = authConfigured() && Boolean(adminConfig());

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
          <LoginShowcase />
          <div className="trust-row"><span>✦ Made for modern cafés</span><span>⌁ Built to scale</span><span>◉ Workspace-level security</span></div>
        </section>
        <section className="auth-card-wrap">
          <div className="auth-card">
            <div className="card-topline"><span>WELCOME BACK</span><span className="sparkle">✦</span></div>
            <h2>Good to have<br />you back.</h2>
            <p className="auth-subtitle">Use the Restaurant ID and temporary or current password provided by CafeOS.</p>
            {params.error && <p role="alert" className="auth-alert auth-error">{params.error}</p>}
            {params.notice && <p role="status" className="auth-alert auth-success">{params.notice}</p>}
            {!configured && <p role="alert" className="auth-alert auth-warning">Authentication setup is incomplete. Configure the Supabase URL, publishable key, and server-only Supabase secret in the Preview environment.</p>}
            <form action={signInAction} className="auth-form">
              <label>Restaurant ID<span className="input-shell"><span aria-hidden="true">▦</span><input name="restaurant_id" type="text" autoComplete="username" required maxLength={64} placeholder="CAFE-AB12-34CD56EF" style={{ textTransform: "uppercase" }} /></span></label>
              <label>Password<PasswordField name="password" placeholder="Enter your password" /></label>
              <p className="auth-subtitle" style={{ marginTop: 0, fontSize: 12 }}>Lost your password? Contact the CafeOS platform administrator for a secure reset.</p>
              <button disabled={!configured} className="auth-submit"><span>Sign in to CafeOS</span><span className="submit-arrow">↗</span></button>
            </form>
            <div className="auth-divider"><span>SECURE RESTAURANT ACCESS</span></div>
            <p className="auth-subtitle">Restaurant accounts are created by the CafeOS platform administrator. Public signup is disabled.</p>
            <p className="auth-privacy"><span>◈</span> Your workspace is protected by role-based access and database-level tenant isolation.</p>
          </div>
          <p className="auth-footer">A calmer shift starts here. <span>☕</span></p>
        </section>
      </div>
    </main>
  );
}
