"use client";

import { useEffect, useState } from "react";

const slides = [
  { kicker: "A smoother service", title: "Every order\nin sync.", body: "Bring counter orders, QR ordering and your team into one calm workflow.", image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1400&q=85", tag: "ORDERS · SERVICE" },
  { kicker: "Know your numbers", title: "Your café.\nAt a glance.", body: "See the daily picture clearly, from sales performance to the details that matter.", image: "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1400&q=85", tag: "SALES · INSIGHTS" },
  { kicker: "Made for your people", title: "Great teams\nmake great cafés.", body: "Keep your workspace, branches and people connected as your business grows.", image: "https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=1400&q=85", tag: "TEAM · WORKSPACE" },
];

export function LoginShowcase() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setActive((current) => (current + 1) % slides.length), 5200);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <section className="login-showcase" aria-label="CafeOS product highlights">
      <div className="showcase-slides">
        {slides.map((slide, index) => (
          <article key={slide.tag} className="showcase-slide" data-active={active === index} aria-hidden={active !== index}>
            <div className="showcase-image" style={{ backgroundImage: 'linear-gradient(180deg,rgba(13,31,22,.04) 10%,rgba(13,31,22,.76) 100%),url("' + slide.image + '")' }} />
            <div className="showcase-copy">
              <span className="showcase-kicker"><i /> {slide.kicker}</span>
              <h2>{slide.title.split("\n").map((line, i) => <span key={line}>{i > 0 && <br />}{line}</span>)}</h2>
              <p>{slide.body}</p>
              <span className="showcase-tag">{slide.tag}</span>
            </div>
            <span className="showcase-number">0{index + 1}<i> / 0{slides.length}</i></span>
          </article>
        ))}
      </div>
      <div className="showcase-controls" aria-label="Choose a feature slide">
        <div className="showcase-dots">{slides.map((slide, index) => <button key={slide.tag} aria-label={"Show slide " + (index + 1)} aria-pressed={active === index} data-active={active === index} onClick={() => setActive(index)}><span /></button>)}</div>
        <span className="showcase-autoplay"><span className="autoplay-pulse" /> AUTO PLAY · 5 SEC</span>
      </div>
    </section>
  );
}
