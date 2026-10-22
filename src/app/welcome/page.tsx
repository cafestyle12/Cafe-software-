import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/auth";

export default async function WelcomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?notice=Confirm%20your%20email%20or%20sign%20in%20to%20continue");
  return (
    <main className="welcome-stage">
      <div className="welcome-confetti" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
      <section className="welcome-card">
        <div className="welcome-check"><svg viewBox="0 0 48 48" role="img" aria-label="Success"><path d="M12 25.5 20.5 34 37 15" /></svg></div>
        <p className="welcome-eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
        <h1>Congratulations,<br /><em>welcome to CafeOS.</em></h1>
        <p className="welcome-lead">Your café journey just got a little simpler.</p>
        <div className="founder-note"><div className="founder-avatar">C</div><div><strong>A welcome from our founder</strong><p>“We built CafeOS to give café owners more clarity, more control, and more time for the people who walk through their doors. We’re glad you’re here. Let’s build something wonderful.”</p><span>— The CafeOS founding team</span></div></div>
        <div className="welcome-perks"><span>✦ One connected workspace</span><span>✓ Built for growing cafés</span><span>◈ Your data, your control</span></div>
        <Link href="/onboarding" className="welcome-cta">Set up your café <span>→</span></Link>
        <p className="welcome-foot">A great café is built one thoughtful step at a time.</p>
      </section>
    </main>
  );
}
