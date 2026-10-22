"use client";

import { useActionState } from "react";
import { provisionRestaurantAction, type ProvisionState } from "@/app/actions/platform-admin";

const initialState: ProvisionState = {};

export function ProvisionRestaurantForm() {
  const [state, action, pending] = useActionState(provisionRestaurantAction, initialState);
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Create a restaurant account</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">You choose the Restaurant ID and initial password. Owners will be required to change the initial password after their first sign-in.</p>
      {state.error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state.credentials && (
        <div className="mt-5 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
          <p className="font-semibold">Provisioned: {state.credentials.restaurantName}</p>
          <p className="mt-3">Restaurant ID</p>
          <code className="block select-all break-all rounded-lg bg-white p-3">{state.credentials.restaurantId}</code>
          <p className="mt-3">Initial password — shown only in this response</p>
          <code className="block select-all break-all rounded-lg bg-white p-3">{state.credentials.temporaryPassword}</code>
          <button type="button" onClick={() => navigator.clipboard?.writeText(`Restaurant ID: ${state.credentials?.restaurantId}\nInitial password: ${state.credentials?.temporaryPassword}`)} className="mt-3 rounded-lg border border-emerald-800 px-3 py-2 font-semibold">Copy credentials</button>
          <p className="mt-3">Store these securely and hand them directly to the owner. CafeOS does not store the temporary password for later retrieval.</p>
        </div>
      )}
      <form action={action} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Restaurant name
          <input name="restaurant_name" required minLength={2} maxLength={120} className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3" placeholder="The Coffee House" />
        </label>
        <label className="text-sm font-medium">First branch name
          <input name="branch_name" required minLength={2} maxLength={120} className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3" placeholder="Main Branch" />
        </label>
        <label className="text-sm font-medium">Restaurant ID (you choose)
          <input name="restaurant_id" required minLength={3} maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,31}" title="Use 3–32 letters, numbers, hyphens or underscores; start with a letter or number" autoCapitalize="characters" className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3 uppercase" placeholder="YASHCAFE01" />
          <span className="mt-1 block text-xs text-[var(--muted)]">Use 3–32 letters/numbers, hyphens or underscores. Must be unique.</span>
        </label>
        <label className="text-sm font-medium">Initial password (you choose)
          <input name="initial_password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3" placeholder="Create a strong password" />
          <span className="mt-1 block text-xs text-[var(--muted)]">12–128 characters; include uppercase, lowercase, number and symbol.</span>
        </label>
        <label className="text-sm font-medium sm:col-span-2">Owner name
          <input name="owner_name" required minLength={2} maxLength={120} className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3" placeholder="Restaurant owner" />
        </label>
        <button disabled={pending} className="rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-white disabled:opacity-60 sm:col-span-2">{pending ? "Creating account…" : "Create restaurant with chosen credentials"}</button>
      </form>
    </section>
  );
}
