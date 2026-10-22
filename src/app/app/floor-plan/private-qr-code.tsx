"use client";

import { useMemo } from "react";
import { qrcodegen } from "@/lib/qrcodegen";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

export function PrivateQrCode({ value, label }: { value: string; label: string }) {
  const code = useMemo(() => qrcodegen.QrCode.encodeText(value, qrcodegen.QrCode.Ecc.MEDIUM), [value]);
  const quiet = 4;
  const size = code.size + quiet * 2;
  const path: string[] = [];
  for (let y = 0; y < code.size; y++) {
    for (let x = 0; x < code.size; x++) {
      if (code.getModule(x, y)) path.push(`M${x + quiet} ${y + quiet}h1v1h-1z`);
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="QR code for ${escapeHtml(label)}"><rect width="${size}" height="${size}" fill="#fff"/><path d="${path.join("")}" fill="#000"/></svg>`;

  function download() {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cafeos-${label.replace(/[^a-z0-9_-]/gi, "-").toLowerCase()}-qr.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function print() {
    const popup = window.open("", "_blank", "width=640,height=760");
    if (!popup) {
      window.alert("Allow pop-ups to print the QR card, or download the SVG instead.");
      return;
    }
    popup.document.open();
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>CafeOS QR — ${escapeHtml(label)}</title><style>body{font:16px system-ui,sans-serif;text-align:center;padding:32px;color:#111}.card{max-width:360px;margin:0 auto;border:1px solid #ddd;border-radius:20px;padding:24px}svg{width:100%;height:auto;image-rendering:pixelated}.hint{font-size:12px;color:#555}@media print{button{display:none}.card{border:0}}</style></head><body><section class="card"><h1>CafeOS</h1><h2>${escapeHtml(label)}</h2>${svg}<p class="hint">Scan to identify this table. Ordering and payment are not enabled by this QR alone.</p><button onclick="window.print()">Print QR card</button></section></body></html>`);
    popup.document.close();
    popup.focus();
  }

  return <div className="mt-3 rounded-xl border border-[var(--border)] bg-white p-3">
    <div className="mx-auto max-w-[220px] bg-white p-2"><svg data-cafeos-qr-svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`QR code for ${label}`} className="h-auto w-full"><rect width={size} height={size} fill="#fff"/><path d={path.join("")} fill="#000"/></svg></div>
    <p className="mt-2 break-all text-center text-xs text-[var(--muted)]">QR for {label}</p>
    <div className="mt-3 flex flex-wrap justify-center gap-2">
      <button type="button" onClick={download} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold">Download SVG</button>
      <button type="button" onClick={print} className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white">Print QR card</button>
    </div>
  </div>;
}
