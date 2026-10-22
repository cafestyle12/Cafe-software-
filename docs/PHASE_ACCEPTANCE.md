# Phase Acceptance Checklist

Each phase must be independently verified before the next phase begins. Code presence alone is not acceptance evidence.

## 00 — Repository and environment audit
- [x] Inspect connected GitHub, Supabase, Vercel capabilities and existing project state.
- [x] Record target choices and avoid destructive remote changes.

## 01 — Architecture and engineering foundation
- [x] Initial app shell committed to selected repository.
- [x] Architecture decisions, module boundaries, data model, threat model, and offline design documented.
- [x] Environment variable names documented without secret values.
- [x] Strict TypeScript and lint/test scripts configured.
- [x] Dependency versions pinned.
- [x] Lockfile committed and deterministic CI installation configured.
- [x] Lint, typecheck, unit tests, and production build verified in successful run #23.
- [x] Deployment intentionally deferred per user instruction; no deployment triggered.
- [x] No business schema or production data changed in Phase 01.

## 02 — Authentication, tenants, and permissions (in progress)
- [x] Supabase Auth UI/actions implemented for sign-in, sign-up, sign-out, email confirmation, password recovery, and password update.
- [x] Secure HttpOnly session cookies and request-time token validation/refresh implemented.
- [x] Profiles, tenants, branches, memberships, branch memberships, roles, granular permissions, invite model, and audit events created in Supabase.
- [x] RLS enabled and forced on all eleven public tables; security advisor returned no findings.
- [x] Atomic tenant + first branch onboarding and default owner/manager/staff role seeding implemented.
- [x] System roles protected from ordinary role CRUD; owner membership protections and role-assignment boundaries added.
- [x] Tenant slug normalization unit tests added.
- [x] GitHub Actions CI run #72 passed: dependency install, lint, typecheck, unit tests, and production build.
- [x] TinyFish public browser smoke test passed for landing/auth pages and unauthenticated protected-route redirects on the Phase 02 preview.
- [x] Branch-scoped Vercel Preview environment variables set; preview redeployment is READY.
- [x] Supabase Auth Site URL and allowed redirect URL configured for the branch alias and verified in the dashboard.
- [ ] Real email confirmation/recovery flow accepted end-to-end. Recovery currently shows `Could not send the recovery email. Try again later`; prior `/verify` attempts logged HTTP 403 `Email link is invalid or has expired`.
- [x] Transactional SQL negative tests passed for tenant A/B read isolation, branch-scoped member visibility, cross-tenant branch insert denial, owner-membership protection, manager role-assignment boundaries, and manager owner-invite escalation denial.\n- [ ] Full browser/session integration and branch-scoped membership tests executed with real authenticated sessions.
- [x] Animated, responsive CafeOS login redesign committed to the Phase 02 branch and confirmed live on preview; orbiting large-circle illustration, bounce/float/rotate/pulse/entrance transitions, hover states, and reduced-motion support included.
- [x] Invitation delivery/acceptance actions, invitation cancellation, and member disable/revoke actions implemented with server-side checks and audit events.
- [ ] Configure `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` as a server-only Vercel Preview environment variable; then test invitation delivery/acceptance and member disable/revoke with a test inbox.
- [x] Database role-boundary tests passed for owner protection and manager privilege escalation attempts.\n- [ ] Session revocation and browser-level role-boundary tests pass.
- [x] Supabase security advisor returned no findings; performance advisor reports only unused-index informational notices on the empty workload.
- [ ] Final Phase 02 security/performance review signed off after CI and authenticated negative tests; Phase 02 remains open until recovery email, authenticated onboarding, invitation/member actions, and session revocation pass.

## 03 — Café setup, branches, tables, floor plans, QR
- [ ] Tenant settings, branch configuration, tables, floor plan data, QR token issuance/revocation.
- [ ] Public QR sessions cannot access staff data or other branches.

## 04 — Menu, modifiers, recipes, pricing, availability
- [ ] Versioned prices, modifiers, allergen/dietary metadata, availability.
- [ ] Price and menu change authorization/audit tests.

## 05 — POS, billing, taxes, cash, merchant UPI
- [ ] Validated order and bill calculation, INR minor units, configurable tax snapshots.
- [ ] Payment pending/verified/reconciled states and idempotent settlement/refund flows.

## 06 — Customer QR ordering, shared carts, tracking
- [ ] Scoped table sessions, validated cart, duplicate prevention, order tracking.
- [ ] Abuse/rate-limit and public access tests.

## 07 — KDS, realtime, timers, alerts, announcements
- [ ] Station routing, item transitions, event deduplication, reconnect tests.
- [ ] Allergy alerts and stale-event handling.

## 08 — Employee operations
- [ ] Attendance, shifts, tasks, leave, notifications, correction audit.
- [ ] Permission and timezone tests.

## 09 — Inventory, purchasing, costing, wastage
- [ ] Inventory ledger, recipes, supplier/purchase order flows, stock reconciliation.
- [ ] Duplicate movement and concurrency tests.

## 10 — Feedback, loyalty, rewards, notifications
- [ ] Consent-aware customer records, loyalty ledger, abuse prevention, notification preferences.

## 11 — SaaS subscriptions, plans, entitlements
- [ ] Plan limits, tenant entitlements, usage accounting, billing integration decisions.

## 12 — Analytics and advanced AI
- [ ] Reproducible reports and forecasts, cost limits, provider fallback, data minimization.
- [ ] AI cannot authorize payments, pricing, refunds, permissions, or stock changes.

## 13 — 3D menu, supported AR, asset management, kitchen orb
- [ ] Optimized assets, lazy loading, reduced motion, 2D fallback, device capability detection.

## 14 — Integrations, kiosk, advanced management
- [ ] Official provider consent/credentials, webhook validation, exports, integration failure recovery.

## 15 — Local offline service and resilience
- [ ] Durable local journal, idempotent sync, conflict/reconciliation UI, device recovery.
- [ ] WAN loss/restoration and restart simulations pass.

## 16 — Security audit and production release
- [ ] Tenant isolation, auth, order, payment, inventory, realtime, and offline tests pass.
- [ ] Accessibility, responsive checks, measured load tests, dependency/secret scans.
- [ ] Backup restore, monitoring, health checks, rollback, and operator runbook verified.
- [ ] End-to-end onboarding-to-reporting flow verified.
- [ ] Launch-readiness report records passed, failed, blocked, and untested checks.


## Audit recheck — 2026-10-22
- [x] Inspected repository metadata, Phase 02 branch, PR #1, package scripts, environment example, auth actions, callback client, middleware, migration inventory, and current Supabase Auth logs.
- [x] Root cause identified in resend API usage: `type=signup` was not sent as the required query parameter; corrected in `src/app/actions/email.ts`.
- [x] Documented Supabase HTTP 429 email throttling as a provider limit that must not be bypassed.
- [ ] Green CI for the latest resend correction commit.
- [ ] Test actual resend request against Supabase after cooldown and verify a fresh confirmation email reaches a controlled test inbox.
- [ ] Verify confirmation callback with a fresh link, recovery email/link, expired/malformed callback, login, logout, refresh, and protected-route behavior using real test sessions.
- [ ] Verify SMTP provider, sender identity/domain/DNS, templates, quota and deliverability. The available connection could not read these settings; no delivery success is claimed.
- [ ] Verify current preview deployment includes the latest commit. Connected Vercel deployment listing returned 403.
- [ ] Configure server-only Supabase secret key for Preview and test invitation/member admin actions; no secret values should be committed.
- [ ] Final Phase 02 acceptance remains blocked until all mandatory gates above pass.
- Phase 03: NOT STARTED.


## Final audit gate update — 2026-10-22
- [x] Latest resend endpoint correction passed GitHub Actions run #117 (install, lint, typecheck, Vitest, production build): https://github.com/cafestyle12/Cafe-software-/actions/runs/39735158907.
- [ ] Vercel deployment is currently blocked: commit status reports failure with a `build-rate-limit` URL. Previous READY-preview notes do not prove the latest commit is live.
- [ ] End-to-end delivery and confirmation/recovery callbacks remain unverified with a controlled inbox.
- [ ] Supabase Security Advisor warns that leaked-password protection is disabled; enable it before production.
- [ ] SMTP provider, sender-domain/DNS, email template and quota settings could not be inspected through the connected API.
- Phase 00: audit documentation exists; external mail-provider configuration evidence remains unavailable.
- Phase 01: scripts, pinned dependencies, lockfile and CI exist; current CI passes. Vercel deployment availability remains blocked by platform build-rate limit.
- Phase 02: NOT ACCEPTED. RLS negative tests passed previously and latest CI passed, but email E2E, latest deployed preview, real authenticated session/tenant tests, invite secret configuration and leaked-password protection remain open.
- Phase 03: NOT STARTED.


## 02 — Restaurant ID + password rebuild acceptance gate (in progress)
- [x] Audited actual repository auth routes, direct REST auth implementation, tenant/membership/role schema, migration history, RLS helpers, Supabase Auth logs and current password-auth documentation before editing.
- [x] Chose supported Supabase Auth identity mapping rather than inventing native username/password support: Restaurant ID resolves server-side to a generated internal alias on a non-deliverable reserved domain; Supabase Auth verifies passwords and issues sessions.
- [x] Added server-only platform administrator console and one-time provisioning credential UI; code uses the supported Auth Admin API, no direct writes to auth.users, and attempts Auth-user rollback if DB provisioning fails.
- [x] Added Restaurant ID login, hashed database rate limits (five attempts then 15-minute cooldown), first-login password-change flow, current-password reauthentication for later changes, administrator reset and account status actions.
- [x] Added tenant RLS helper conditions for active tenant and mapped owner account status / first-login flag.
- [x] Removed public signup, email recovery UI/action, resend-confirmation action and the email confirmation callback. Disabled email-based member invitations; retained old invite rows.
- [x] Added additive migration and unit tests for generated IDs/passwords/internal aliases.
- [ ] Apply and verify the new migration in Supabase; confirm function grants and RLS state.
- [ ] Configure server-only Supabase secret and platform admin token in Vercel Preview; redeploy latest branch commit.
- [ ] Confirm Supabase Admin API accepts the .invalid internal alias in the target project; provision a controlled test restaurant and test login.
- [ ] Verify first-login RLS denial, password change, old temporary-password rejection, later reauthentication, reset, suspension, deactivation and reactivation using real sessions.
- [ ] Run and pass latest CI lint, typecheck, unit tests and production build; inspect the actual run result.
- [ ] Verify preview URL and commit, then run the authenticated browser smoke test. Do not merge or deploy production without explicit authorization.

Phase 03 remains NOT STARTED.


## Final verification snapshot — 2026-10-22
- [x] Latest branch-head CI run #209 passed install, lint, typecheck, unit tests and production build (commit cc7a4faea20a27a16cc526ee4b95357f46f58935).
- [x] Additive Supabase migration applied and migration history verified; RLS and service-role grants checked.
- [x] Database-backed rate-limit SQL test passed: five attempts allowed, sixth blocked; test transaction rolled back.
- [ ] Latest branch head deployed to Vercel Preview — blocked by Vercel API 403 permission denied. Existing READY preview is an older commit.
- [ ] Server-only Supabase secret and platform admin token configured in Preview — not confirmed.
- [ ] Live Auth Admin API accepts the internal .invalid alias and end-to-end provisioning/login/password-reset/suspension tests pass — not yet testable without the secret and latest deployment.
- [ ] Leaked-password protection enabled in Supabase Auth.

Phase 02 remains IN PROGRESS, not accepted. Phase 03 has NOT STARTED.


- [x] Audited the legacy create_tenant_with_branch RPC grants; revoked client execution in applied migration 20261022092809 and verified only service_role retains EXECUTE.

- [x] RLS gate now requires Restaurant ID owner metadata and a matching active mapping row with first-login password change cleared; rollback-only SQL test passed for first-login, active, suspended-account and suspended-tenant cases.


- [x] Added session_version UUID binding across Auth app_metadata, restaurant mapping, middleware and RLS. Provisioning/reset/status changes rotate the version; stale JWTs are denied.
- [x] Rollback-only SQL test passed for first-login denial, active owner access, stale-version denial, suspended account and suspended tenant.
- [ ] Configure missing Preview secrets and verify real Supabase Auth Admin API behavior with a controlled restaurant.
- [ ] Deploy the latest branch head and run full live login/password/reset/suspend tests. Existing preview is an older commit.

- [x] Closed direct tenant table INSERT bypass and RLS-bypassing TRUNCATE/REFERENCES/TRIGGER grants; verified no anon/authenticated dangerous table privileges remain.


## Acceptance decision — 2026-10-22
**Phase 02 remains IN PROGRESS.** Code-level checks and database security migrations are in place, but the acceptance gate is not met until the latest branch is deployed to Preview, required server-only secrets are configured, the Supabase Admin API accepts the internal alias, and a controlled end-to-end provisioning/login/password-reset/suspension test passes. The current Preview is an older commit and deployment permission is denied. Phase 03 has NOT STARTED.
