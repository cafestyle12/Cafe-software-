"use client";

import { useState } from "react";

type Props = {
  name: string;
  placeholder: string;
  autoComplete?: string;
  required?: boolean;
};

export function PasswordField({ name, placeholder, autoComplete = "current-password", required = true }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="input-shell" style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span aria-hidden="true">⌑</span>
      <input name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} required={required} minLength={name === "current_password" ? undefined : 12} placeholder={placeholder} style={{ minWidth: 0, flex: 1 }} />
      <button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Hide password" : "Show password"} style={{ border: 0, background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
        {visible ? "Hide" : "Show"}
      </button>
    </span>
  );
}
