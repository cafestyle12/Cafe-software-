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
- [x] GitHub Actions CI run #47 passed: dependency install, lint, typecheck, unit tests, and production build.
- [x] TinyFish public browser smoke test passed for landing/auth pages and unauthenticated protected-route redirects on the Phase 02 preview.
- [x] Branch-scoped Vercel Preview environment variables set; preview redeployment is READY.
- [ ] Supabase Auth Site URL and allowed redirect URL configured for the branch alias; end-to-end sign-up/sign-in/confirmation/recovery verified against configured Supabase email templates.
- [x] Transactional SQL negative tests passed for tenant A/B read isolation, branch-scoped member visibility, cross-tenant branch insert denial, owner-membership protection, manager role-assignment boundaries, and manager owner-invite escalation denial.\n- [ ] Full browser/session integration and branch-scoped membership tests executed with real authenticated sessions.
- [x] Invitation delivery/acceptance actions, invitation cancellation, and member disable/revoke actions implemented with server-side checks and audit events.
- [ ] Configure `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` as a server-only Vercel Preview environment variable; then test invitation delivery/acceptance and member disable/revoke with a test inbox.
- [x] Database role-boundary tests passed for owner protection and manager privilege escalation attempts.\n- [ ] Session revocation and browser-level role-boundary tests pass.
- [x] Supabase security advisor returned no findings; performance advisor reports only unused-index informational notices on the empty workload.
- [ ] Final Phase 02 security/performance review signed off after CI and authenticated negative tests.

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
