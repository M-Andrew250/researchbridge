-- The Express backend connects as service_role. RLS being enabled
-- does NOT by itself grant table access — service_role still needs
-- ordinary Postgres GRANTs, same as any other role. This was missed
-- in the initial migration (tables were created via the SQL Editor,
-- so they didn't pick up Supabase's usual default-privilege wiring).

grant usage on schema public to service_role;

grant select, insert, update, delete
  on public.profiles, public.enrolments, public.contact_messages
  to service_role;

-- So any tables created by future migrations grant service_role
-- access automatically, without needing to repeat this step.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
