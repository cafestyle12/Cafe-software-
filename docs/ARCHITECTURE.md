# CafeOS Architecture

## Phase 02 identity model
Restaurant ID is a human-selected login identifier mapped server-side to a non-deliverable Supabase Auth identity. Password verification and sessions remain in Supabase Auth. Tenant access is gated by membership, restaurant account status, first-login password-change state, and session version.

## Phase 03 branch, seating and QR model
- `tenants` and `branches` remain the Phase 02 tenant hierarchy; Phase 03 extends them additively.
- `seating_zones` groups tables within one branch. `cafe_tables` stores stable UUID identity, label, capacity, shape and logical coordinates.
- `floor_plan_layouts` stores the logical coordinate-system dimensions and a version number. A conflict-safe layout write action is still pending.
- `table_qr_credentials` stores SHA-256 hashes of cryptographically random opaque QR tokens, with active/revoked status.
- `resolve_table_qr(text)` is the narrow anonymous resolver and returns only display-safe restaurant, branch and table fields.
- `table_sessions` is private to service-role operations; a secure session initialization endpoint with idempotency, expiration and revocation remains pending.

## Phase boundary
Phase 03 does not include menu catalog, POS, ordering, billing, payments, inventory or analytics. Do not start Phase 04 until the Phase 03 acceptance gate is met.
