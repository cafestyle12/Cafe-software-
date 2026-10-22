create or replace function public.accept_membership_invite(invite_uuid uuid, accepted_user_id uuid)
returns uuid language plpgsql security invoker set search_path = public
as $$
declare invite_row public.membership_invites%rowtype; account_email text; new_membership_id uuid;
begin
 select lower(u.email) into account_email from auth.users u where u.id = accepted_user_id;
 if account_email is null then raise exception 'Authenticated account not found' using errcode = '42501'; end if;
 select * into invite_row from public.membership_invites i
 where i.id = invite_uuid and i.email = account_email and i.status = 'pending' and i.expires_at > now() for update;
 if not found then raise exception 'Invitation is invalid, expired, or does not match this account' using errcode = '42501'; end if;
 if exists (select 1 from public.memberships m where m.tenant_id = invite_row.tenant_id and m.user_id = accepted_user_id) then
   raise exception 'This account already has a membership in the workspace';
 end if;
 insert into public.memberships(tenant_id,user_id,status) values (invite_row.tenant_id,accepted_user_id,'active') returning id into new_membership_id;
 insert into public.membership_roles(tenant_id,membership_id,role_id) values (invite_row.tenant_id,new_membership_id,invite_row.role_id);
 update public.membership_invites set status='accepted',accepted_at=now() where id=invite_row.id;
 insert into public.audit_events(tenant_id,actor_id,action,entity_type,entity_id)
 values (invite_row.tenant_id,accepted_user_id,'member.invitation_accepted','membership',new_membership_id::text);
 return new_membership_id;
end
$$;
revoke all on function public.accept_membership_invite(uuid,uuid) from public, anon, authenticated;
grant execute on function public.accept_membership_invite(uuid,uuid) to service_role;
