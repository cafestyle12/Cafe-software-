# Domain Boundaries

## Application layers
1. Presentation — accessible, responsive role-specific pages and components; no trusted financial or permission decisions.
2. Application services — validated use cases, authorization, idempotency, orchestration, and transaction boundaries.
3. Domain — canonical entities, value objects, state-transition rules, and provider-neutral interfaces.
4. Infrastructure — Supabase clients, repositories, job queue, external-provider adapters, local service client, logging, and telemetry.
5. Database — constraints, indexes, RLS policies, migrations, transactional functions where justified, and durable audit records.

## Initial module boundaries
- Identity and access: users, tenants, branches, memberships, roles, permissions, invitations.
- Café configuration: profile, settings, tables, floor plans, QR sessions, branding.
- Catalog: categories, products, variants, modifiers, allergens, dietary tags, availability, price versions.
- Orders: order headers, line snapshots, modifiers, customer/table context, idempotency, state transitions.
- Kitchen: stations, ticket routing, item state, timers, recalls, announcements.
- Billing and payments: bill snapshots, tax rules, cash entries, UPI verification, settlements, refunds, reconciliation.
- Workforce: employee profiles, shifts, attendance, tasks, leave, corrections.
- Inventory: ingredients, units, recipes, stock locations, movements, wastage, suppliers, purchase orders.
- Customer engagement: feedback, loyalty ledger, notifications, consent and preferences.
- SaaS platform: plans, subscriptions, entitlements, usage counters, support administration.
- Reporting: immutable financial facts, analytics projections, exports.
- Integrations: typed adapters and provider webhook handling.
- Offline operations: local device registry, durable operations, sync cursor, conflicts, reconciliation.

## Cross-cutting invariants
- Every write is authenticated or deliberately limited to a scoped public flow.
- Authorization is re-evaluated server-side for each sensitive operation.
- Client-supplied prices, totals, permissions, payment state, and inventory balances are never trusted.
- Order submission and sync retries are idempotent.
- Money is stored as integer minor units plus currency; no binary floating-point arithmetic for authoritative totals.
- Financial events and inventory movements are append-only ledger facts, with controlled correction/reversal events.
- Sensitive operations emit actor, scope, reason, timestamp, and before/after metadata into an access-controlled audit trail.
