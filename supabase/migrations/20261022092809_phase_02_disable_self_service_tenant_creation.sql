-- Phase 02: disable client-callable self-service tenant creation.
-- Restaurant tenants must now be created only through the service-role-only
-- admin_provision_restaurant RPC after the Auth identity has been provisioned.
revoke all on function public.create_tenant_with_branch(text, text, text) from public, anon, authenticated;
grant execute on function public.create_tenant_with_branch(text, text, text) to service_role;
