"use client";

import { useActionState } from "react";
import { issueTableQrAction, type IssueQrState } from "@/app/actions/floor-plan";
import { PrivateQrCode } from "@/app/app/floor-plan/private-qr-code";

const initialState: IssueQrState = {};

export function QrIssueForm({ tenantId, branchId, tableId, activeQr }: { tenantId: string; branchId: string; tableId: string; activeQr: boolean }) {
  const [state, action, pending] = useActionState(issueTableQrAction, initialState);
  return <div className="mt-3">
    <form action={action}>
      <input type="hidden" name="tenant_id" value={tenantId}/>
      <input type="hidden" name="branch_id" value={branchId}/>
      <input type="hidden" name="table_id" value={tableId}/>
      <button disabled={pending || activeQr} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold disabled:opacity-50">{pending ? "Issuing…" : activeQr ? "Revoke current QR first" : "Issue QR"}</button>
    </form>
    {activeQr && <p className="mt-2 text-xs text-[var(--muted)]">Revoke the current credential first. Previously printed copies will stop working; then issue a new one.</p>}
    {state.error && <p role="alert" className="mt-2 text-xs text-red-700">{state.error}</p>}
    {state.url && <section className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
      <p className="text-sm font-semibold">New QR credential for table {state.tableLabel}</p>
      <p className="mt-1 text-xs">Copy this URL now. It is shown once; the stored database value is a hash.</p>
      <code className="mt-2 block break-all rounded-lg bg-white p-2 text-xs">{state.url}</code>
      <PrivateQrCode value={state.url} label={"Table " + (state.tableLabel ?? "")} />
      <button type="button" onClick={() => navigator.clipboard?.writeText(state.url ?? "")} className="mt-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white">Copy URL</button>
      <a href={state.url} target="_blank" rel="noreferrer" className="ml-2 inline-flex rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold">Test link</a>
    </section>}
  </div>;
}
