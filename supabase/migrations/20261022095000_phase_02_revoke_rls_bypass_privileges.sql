-- Phase 02 security hardening: remove table privileges that bypass row-level
-- policies or are unnecessary for browser roles. In particular, TRUNCATE is not
-- filtered by RLS and must never be granted to anon/authenticated.
revoke all privileges on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon;
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from public, anon, authenticated;
