# CafeOS Threat Model

## Assets
Tenant business records, customer contact/consent data, employee and attendance records, menu prices, orders, financial settlements, inventory movements, QR tokens, authentication sessions, provider credentials, backups, and audit events.

## Trust boundaries
- Public customer browser ↔ public QR/order API
- Staff browser/device ↔ authenticated application API
- Vercel runtime ↔ Supabase database/Auth/Storage
- Café local network ↔ local operations service and store devices
- CafeOS control plane ↔ tenant control plane
- Application ↔ payment, WhatsApp, accounting, maps, delivery, AI, and hardware providers

## Threats and required mitigations
- Cross-tenant IDOR/BOLA: derive tenant/branch scope from authenticated membership; enforce RLS; test reads, writes, realtime, storage, exports, and jobs across two synthetic tenants.
- Role escalation: do not trust client metadata or hidden UI; use server-side permission checks and database constraints. Audit role changes.
- QR token theft/replay: use high-entropy scoped tokens, store hashes, short configurable expiry, revocation, rate limits, and narrow public permissions.
- Order duplication/races: require idempotency keys and unique constraints; validate state transitions transactionally; test concurrent submissions and retries.
- Payment spoofing: never accept screenshots/client flags as settlement proof; record pending until trusted provider confirmation or authorized employee verification; reconcile duplicates and refunds.
- Inventory tampering: append-only movements, unique operation IDs, restricted adjustments, approvals, and reconciliation reports.
- Secrets leakage: no service-role keys in browser bundles or NEXT_PUBLIC_*; redact logs; scan commits and deployment configuration; use least privilege.
- Webhook forgery/replay: verify provider signatures, timestamp tolerance, event IDs, and idempotency before processing.
- Malicious uploads: allowlisted content types, size limits, generated storage names, authorization, and safe rendering.
- Offline device theft/tampering: minimize locally cached PII, encrypt sensitive local state where practical, bind devices, expire credentials, and expose recovery/revocation controls.
- AI prompt injection/data exfiltration: treat model output and retrieved text as untrusted; minimize provider data; never let model output authorize financial, pricing, inventory, or permission changes.
- Abuse/denial of service: endpoint-specific rate limits, payload limits, quotas, bounded retries, and operational alerting.
- Supply-chain/build compromise: exact dependency versions, reviewed lockfile, automated dependency/security scans, protected deployment configuration, and least-privilege CI.

## Security acceptance requirements
- Default-deny authorization and RLS for all tenant-owned data.
- Automated negative tests across at least two tenants and multiple roles.
- No privileged secrets in Git history, browser bundles, logs, or client-visible errors.
- Audit trails for refunds, voids, price changes, permission changes, attendance corrections, and stock adjustments.
- Backup restoration and credential rotation runbooks before production release.

This threat model is initial and must be revisited after authentication, payment, local-service, and integration designs are implemented.
