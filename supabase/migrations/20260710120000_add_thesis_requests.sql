-- Thesis Editing & Proofreading service requests, submitted from
-- pages/thesis-editing.html. Mirrors the enrolments pattern: guests
-- and logged-in users can both submit (user_id nullable), status is
-- managed by admins from the dashboard.
create table public.thesis_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  document_type text not null
    check (document_type in ('Bachelor''s Dissertation', 'Master''s Thesis', 'PhD Thesis', 'Journal Article', 'Other')),
  word_count integer,
  citation_style text,
  deadline date,
  instructions text,
  file_paths text[] not null default '{}',
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'completed', 'cancelled')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.thesis_requests enable row level security;

create trigger thesis_requests_set_updated_at
  before update on public.thesis_requests
  for each row execute function public.set_updated_at();

create index thesis_requests_user_id_idx on public.thesis_requests (user_id);
create index thesis_requests_email_idx on public.thesis_requests (email);
create index thesis_requests_status_idx on public.thesis_requests (status);

-- Private Storage bucket for uploaded documents — only the server
-- (service_role, bypasses RLS) reads/writes it, same as course-materials.
-- Admins view files via short-lived signed URLs generated on request.
insert into storage.buckets (id, name, public)
values ('thesis-submissions', 'thesis-submissions', false)
on conflict (id) do nothing;