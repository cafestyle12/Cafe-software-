# Initial Data Model (Proposed)

This is a planning model, not an applied schema. Foreign keys, indexes, retention, RLS policies, and constraints will be designed in migration reviews before implementation.

## Tenant and access
- tenants(id, name, slug, status, created_at)
- branches(id, tenant_id, name, timezone, currency, settings, status)
- profiles(user_id, display_name, locale, status)
- memberships(id, tenant_id, user_id, status)
- branch_memberships(id, tenant_id, branch_id, user_id, status)
- roles(id, tenant_id, name)
- permissions(id, key, description)
- role_permissions(role_id, permission_id)
- membership_roles(membership_id, role_id)

## Café setup and catalog
- cafe_tables(id, tenant_id, branch_id, label, capacity, status)
- qr_sessions(id, tenant_id, branch_id, table_id, token_hash, expires_at, revoked_at)
- menu_categories(id, tenant_id, branch_id, name, sort_order, status)
- menu_items(id, tenant_id, branch_id, name, description, status)
- menu_item_prices(id, tenant_id, branch_id, menu_item_id, currency, amount_minor, valid_from, valid_until)
- modifier_groups(id, tenant_id, branch_id, name, min_select, max_select)
- modifiers(id, tenant_id, branch_id, group_id, name, price_delta_minor)
- item_allergens(id, tenant_id, branch_id, menu_item_id, allergen_code)

## Orders and kitchen
- orders(id, tenant_id, branch_id, order_number, source, order_status, payment_status, bill_status, idempotency_key, created_by)
- order_items(id, tenant_id, branch_id, order_id, item_snapshot, quantity, unit_amount_minor, tax_snapshot, kitchen_status)
- order_item_modifiers(id, tenant_id, branch_id, order_item_id, modifier_snapshot, amount_minor)
- kitchen_stations(id, tenant_id, branch_id, name, status)
- kitchen_tickets(id, tenant_id, branch_id, order_id, station_id, status, started_at, completed_at)

## Billing and financial records
- bills(id, tenant_id, branch_id, order_id, currency, subtotal_minor, tax_minor, discount_minor, service_charge_minor, total_minor, policy_snapshot)
- payment_attempts(id, tenant_id, branch_id, bill_id, method, status, idempotency_key, provider_reference)
- settlements(id, tenant_id, branch_id, bill_id, amount_minor, method, verified_by, verified_at)
- refunds(id, tenant_id, branch_id, settlement_id, amount_minor, status, approved_by, reason)
- cash_sessions(id, tenant_id, branch_id, opened_by, opening_minor, closed_by, closing_minor, status)
- audit_events(id, tenant_id, branch_id, actor_id, action, entity_type, entity_id, reason, before_state, after_state, created_at)

## Workforce and inventory
- employees(id, tenant_id, branch_id, user_id, employment_status)
- shifts(id, tenant_id, branch_id, employee_id, starts_at, ends_at, status)
- attendance_events(id, tenant_id, branch_id, employee_id, event_type, occurred_at, corrected_by)
- ingredients(id, tenant_id, branch_id, name, base_unit, status)
- recipes(id, tenant_id, branch_id, menu_item_id, version, status)
- recipe_ingredients(id, tenant_id, branch_id, recipe_id, ingredient_id, quantity_base_unit)
- inventory_movements(id, tenant_id, branch_id, ingredient_id, quantity_delta, reason, source_type, source_id, idempotency_key, created_at)
- suppliers(id, tenant_id, branch_id, name, status)
- purchase_orders(id, tenant_id, branch_id, supplier_id, status, total_minor)

## SaaS, customer engagement, integrations, sync
- plans(id, code, limits, feature_entitlements, status)
- subscriptions(id, tenant_id, plan_id, status, period_start, period_end)
- usage_events(id, tenant_id, feature_key, quantity, occurred_at)
- customers(id, tenant_id, display_name, contact_hash, consent_state)
- loyalty_ledger(id, tenant_id, customer_id, points_delta, reason, source_id)
- integration_connections(id, tenant_id, branch_id, provider, status, config_reference)
- outbox_events(id, tenant_id, aggregate_type, aggregate_id, event_type, payload, created_at, delivered_at)
- sync_operations(id, tenant_id, branch_id, device_id, operation_id, operation_type, status, payload_hash, received_at, applied_at)
- sync_conflicts(id, tenant_id, branch_id, operation_id, conflict_type, status, resolution, resolved_by)

## Relationship and integrity rules
- Branches belong to exactly one tenant. Tenant-scoped children must carry tenant scope and use composite constraints where practical to prevent cross-tenant references.
- Memberships authorize access only within their tenant and explicitly granted branches.
- Orders retain immutable item, price, and tax snapshots so later catalog changes do not rewrite past receipts.
- Bills and settlements are separate from order and kitchen status.
- Inventory quantity is derived from movements; avoid an independently mutable balance as the sole source of truth.
- QR token secrets are stored as hashes when possible, are scoped to a table/branch, expire, and can be revoked.
- SaaS control-plane access is separate from tenant operations and is explicitly audited.
