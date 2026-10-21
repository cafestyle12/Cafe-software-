# Offline and Local-Service Design (Proposed)

## Objective
Keep essential POS and kitchen workflows operating through internet loss without claiming every browser, payment, printer, or cloud feature works offline.

## Components
1. PWA shell: service worker caches versioned static assets and a safe fallback page. Do not cache privileged API responses indiscriminately.
2. IndexedDB operation journal: stores queued commands with a random operation ID, device ID, schema version, creation time, payload hash, retry count, and status.
3. Store-local service: a separately deployed service on the café's trusted local network coordinates local order acceptance and KDS updates when the WAN is down. It has its own durable database and authenticated device registrations.
4. Cloud sync API: authenticates devices, validates every command, deduplicates operation IDs, records durable receipts, and applies accepted operations.
5. Reconciliation console: exposes pending, synchronized, failed, and conflict/review-required operations.

## Delivery and idempotency
Use at-least-once delivery; assume requests can repeat after a timeout. A unique key scoped to tenant, branch, device, and operation ID prevents duplicate application. Persist each accepted operation result so a retry returns the same outcome.

## Conflict strategy
- Orders: append new orders as immutable commands; never overwrite an existing order silently. Duplicate operation IDs return the prior result.
- Kitchen progress: use versioned state transitions. Reject stale transitions and surface a review task rather than silently reverting completed items.
- Catalog/prices: cache a versioned catalog snapshot. When price validity cannot be confirmed, follow a tenant-configured offline pricing rule and flag reconciliation if policy requires it.
- Payments: record offline cash as a local cash event requiring reconciliation. Never mark UPI paid based on a screenshot or client claim. UPI gateway confirmation needs connectivity or a trusted provider-confirmed record.
- Inventory: append uniquely identified movements. Conflicting stock adjustments require manager review.
- Attendance: retain device timestamp and server receipt timestamp; corrections require authorization and audit.
- Deletion/voids: use explicit, permission-checked compensating events rather than deleting accepted journal entries.

## Connectivity and recovery
Track pending_local, syncing, synced, failed_retryable, failed_terminal, and reconciliation_required. Use bounded exponential backoff with jitter, server acknowledgements, and queue compaction only after durable acknowledgement. Show a visible retry/review interface.

## Local network and device security
- Pair devices through an authenticated setup flow; never expose an unauthenticated LAN admin port.
- Use TLS on the local service where practical, firewall it to the store network, and avoid exposing it publicly.
- Provide device revocation, key rotation, encrypted backups, OS updates, health checks, and documented recovery.
- Browsers may restrict local-network access and device APIs; printer/cash-drawer integrations require supported adapters and a tested fallback.
- Avoid storing unnecessary customer contact data or payment credentials on devices.

## Deployment ownership
Vercel serves the web app and bounded server functions. It is not the persistent local worker. The store-local service and its durable database need a separately managed deployment path and upgrade/rollback plan.

## Required tests (not yet run)
- Disconnect WAN while local LAN remains available; place and route orders.
- Restart browser and local service with queued work pending.
- Restore WAN and replay requests multiple times; verify no duplicate orders or stock movements.
- Inject stale catalog and concurrent kitchen transitions.
- Test clock skew, partial uploads, interrupted acknowledgements, disk-full conditions, and corrupted queue records.
- Revoke a lost device and verify it cannot submit new operations.
