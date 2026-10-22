"use client";

import { useActionState } from "react";
import { resetRestaurantPasswordAction, type ResetPasswordState } from "@/app/actions/platform-admin";

const initialState: ResetPasswordState = {};

export function ResetPasswordForm({ restaurantId }: { restaurantId: string }) {
  const [state, action, pending] = useActionState(resetRestaurantPasswordAction, initialState);
  return (
    <div className="mt-3">
      <form action={action}>
        <input type="hidden" name="restaurant_id" value={restaurantId} />
        <button disabled={pending} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold disabled:opacity-60">{pending ? "Resetting…" : "Reset password"}</button>
      </form>
      {state.error && <p role="alert" className="mt-2 text-xs text-red-700">{state.error}</p>}
      {state.credentials && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
          <p className="font-semibold">Temporary credentials — copy now</p>
          <p className="mt-2">Restaurant ID: <code className="select-all">{state.credentials.restaurantId}</code></p>
          <p className="mt-2 break-all">Temporary password: <code className="select-all">{state.credentials.password}</code></p>
          <button type="button" onClick={() => navigator.clipboard?.writeText(`Restaurant ID: ${state.credentials?.restaurantId}\nTemporary password: ${state.credentials?.password}`)} className="mt-2 rounded-md border border-amber-900 px-2 py-1 font-semibold">Copy credentials</button>
          <p className="mt-2">This password is not stored for retrieval. Provide it securely to the owner.</p>
        </div>
      )}
    </div>
  );
}
