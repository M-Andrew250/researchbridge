-- Admin-editable attributes for the auto-generated course-completion
-- certificate (pages/dashboard.html) — signer name/title/company,
-- logo, signature, and standard wording. Singleton row (id always 1),
-- same pattern as thesis_pricing_settings: these change occasionally
-- (a new signer, a logo refresh) without needing a code deploy.
create table public.certificate_settings (
  id integer primary key default 1 check (id = 1),
  signer_name text not null default 'Andrew MUSHOKAMBERE',
  signer_title text not null default 'Chief Executive Officer',
  signer_company text not null default 'ResearchBridge Consulting Ltd',
  logo_url text,
  signature_url text,
  credential_wording text not null default 'has successfully completed the requirements of the self-paced online course',
  level_span text not null default 'Beginner to Advanced',
  updated_at timestamptz not null default now()
);

insert into public.certificate_settings (id) values (1);

alter table public.certificate_settings enable row level security;

create trigger certificate_settings_set_updated_at
  before update on public.certificate_settings
  for each row execute function public.set_updated_at();

-- Public Storage bucket for admin-uploaded certificate assets (logo,
-- signature). Public because the certificate is drawn client-side in
-- the browser and needs to load these images directly — unlike
-- course-materials (private, signed URLs), there's no per-user access
-- control needed here. Only the admin backend (service-role, bypasses
-- RLS) ever writes to it, so no insert/update/delete policies exist —
-- normal users have no write path at all.
insert into storage.buckets (id, name, public)
values ('site-assets', 'site-assets', true)
on conflict (id) do nothing;

create policy "Site assets are publicly readable"
on storage.objects for select
using (bucket_id = 'site-assets');
