# Architecture Decision Records

## ADR-001: Web application foundation
**Status:** Accepted for Phase 01.

Use Next.js App Router, React, TypeScript, and Tailwind CSS for the initial PWA and role-specific interfaces. Keep UI components thin; business rules belong in typed domain/application services and database constraints.

**Trade-offs:** This keeps the first deployment simple and integrates with Vercel. Persistent jobs, store-local operations, and durable offline coordination must not be implemented as unbounded Vercel request handlers.

## ADR-002: Supabase as primary system of record
**Status:** Accepted, subject to existing-project dedication.

Use Supabase PostgreSQL for authoritative order, payment, inventory, membership, and audit data. Supabase Auth handles identity; RLS and server-side authorization jointly enforce access. Realtime is a delivery mechanism, not the source of truth.

**Trade-offs:** Supabase simplifies early operations, but schema ownership, migrations, RLS regression tests, backups, and cost monitoring are mandatory.

## ADR-003: Multi-tenant authorization model
**Status:** Proposed; implementation belongs to Phase 02.

Every tenant-owned record must be scoped to a tenant and, where applicable, a branch. Memberships and granular permissions govern staff access. Customer QR sessions use separate scoped, revocable tokens and never inherit staff authority.

## ADR-004: Transactional domain boundaries
**Status:** Accepted.

Orders, kitchen tickets, payments, bills, inventory ledger entries, and audit events are separate domain concepts. Order status, kitchen status, settlement status, and bill-closure status must not be collapsed into one enum. Critical state transitions are validated server-side and committed transactionally where possible.

## ADR-005: Provider adapters
**Status:** Accepted.

AI, payment gateways, WhatsApp, accounting, maps, delivery providers, printers, and cash drawers are isolated behind typed interfaces. Provider failure must not corrupt canonical domain state.

## ADR-006: Offline-first operational design
**Status:** Proposed; detailed design in offline-sync.md.

The browser PWA uses IndexedDB for a durable local queue, while a separately deployed local-network service coordinates store-local operations. Synchronization is at-least-once delivery with idempotent application, explicit acknowledgements, and conflict/reconciliation states.

## ADR-007: INR-first financial representation
**Status:** Accepted.

Use integer minor units for money calculations (paise) and persist currency explicitly. Tax, discount, service-charge, and rounding policies are versioned/configurable per tenant and branch. Provider status alone is insufficient unless verified through a trusted server-side confirmation path.

## ADR-008: No premature feature expansion
**Status:** Accepted.

The initial scaffold does not implement login, POS, QR ordering, inventory, AI, AR, or offline synchronization. These remain in their authorized phases; placeholder UI must not imply functional support.
