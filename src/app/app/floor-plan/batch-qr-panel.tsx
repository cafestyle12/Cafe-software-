"use client";

import { useActionState } from "react";
import { issueTableQrBatchAction, type BatchQrState } from "@/app/actions/floor-plan";
import { PrivateQrCode } from "@/app/app/floor-plan/private-qr-code";

type TableOption = { id: string; label: string; capacity: number };

const initial: BatchQrState = {};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

export function BatchQrPanel({ tenantId, branchId, tables }: { tenantId: string; branchId: string; tables: TableOption[] }) {
  const [state, action, pending] = useActionState(issueTableQrBatchAction, initial);

  function printAll() {
    const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-cafeos-qr-card]"));
    const selected = cards.map((card) => ({
      label: card.dataset.cafeosQrCard ?? "Table",
      svg: card.querySelector("[data-cafeos-qr-svg]")?.outerHTML ?? "",
    })).filter((card) => card.svg);
    if (!selected.length) return;
    const popup = window.open("", "_blank", "width=900,height=760");
    if (!popup) {
      window.alert("Allow pop-ups to print this QR batch.");
      return;
    }
    popup.document.open();
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>CafeOS table QR batch</title><style>body{font:14px system-ui,sans-serif;color:#111}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.card{break-inside:avoid;text-align:center;border:1px solid #ddd;border-radius:12px;padding:16px}.card svg{width:100%;max-width:230px;height:auto}.hint{font-size:10px;color:#555}@media print{.grid{gap:8px}.card{border:1px solid #bbb}}</style></head><body><div class="grid">${selected.map(card=>`<section class="card"><h2>${escapeHtml(card.label)}</h2>${card.svg}<p class="hint">Scan to identify this table. Ordering and payments are not enabled by this QR alone.</p></section>`).join("")}</div><script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  }

  return <section className="mt-6 rounded-2xl border border-[var(--border)] bg-white p-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">Batch QR issue & print</h2><p className="mt-1 text-sm text-[var(--muted)]">Select up to 50 active tables without an active QR. Tokens are shown once and are not stored in readable form.</p></div></div>
    {tables.length === 0 ? <p className="mt-4 rounded-xl bg-[var(--cream)] p-3 text-sm text-[var(--muted)]">Every active table already has a QR, or there are no active tables to issue.</p> : <form action={action} className="mt-4">
      <input type="hidden" name="tenant_id" value={tenantId}/><input type="hidden" name="branch_id" value={branchId}/>
      <div className="grid gap-2 sm:grid-cols-2">{tables.slice(0,50).map((table) => <label key={table.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3 text-sm"><input type="checkbox" name="table_id" value={table.id}/><span className="font-semibold">{table.label}</span><span className="text-xs text-[var(--muted)]">{table.capacity} seats</span></label>)}</div>
      {tables.length > 50 && <p className="mt-2 text-xs text-[var(--muted)]">Showing the first 50 tables. Issue this batch, then select the next batch.</p>}
      {state.error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      <button disabled={pending} className="mt-4 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Issuing batch…" : "Issue QR for selected tables"}</button>
    </form>}
    {state.items?.length ? <div className="mt-6 border-t border-[var(--border)] pt-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">New QR batch ({state.items.length})</h3><p className="mt-1 text-xs text-[var(--muted)]">Download individual SVGs or print all cards together. Keep these URLs private.</p></div><button type="button" onClick={printAll} className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold">Print all cards</button></div><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{state.items.map((item) => <article key={item.tableId} data-cafeos-qr-card={"Table " + item.tableLabel} className="rounded-xl border border-[var(--border)] p-3"><p className="mb-2 text-sm font-semibold">Table {item.tableLabel}</p><div data-cafeos-qr-svg><PrivateQrCode value={item.url} label={"Table " + item.tableLabel}/></div></article>)}</div></div> : null}
  </section>;
}
