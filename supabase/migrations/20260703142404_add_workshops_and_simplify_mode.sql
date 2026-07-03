-- Support for in-person workshop scheduling:
--   1. Simplify enrolments.mode to just 'Online' / 'In-Person'
--      (was 'Online — Live Sessions' / 'Online — Self-paced' / 'In-Person — Kigali').
--   2. Add a workshops table admins manage via the Table Editor
--      (venue, date, trainer, fee per course).
--   3. Link an in-person enrolment to the specific workshop chosen.

-- ── WORKSHOPS ──
create table public.workshops (
  id uuid primary key default gen_random_uuid(),
  course_slug text not null,
  venue text not null,
  start_date date not null,
  trainer_name text not null,
  fee text not null,
  status text not null default 'upcoming'
    check (status in ('upcoming', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workshops enable row level security;

create trigger workshops_set_updated_at
  before update on public.workshops
  for each row execute function public.set_updated_at();

create index workshops_course_slug_idx on public.workshops (course_slug);
create index workshops_status_idx on public.workshops (status);

grant select, insert, update, delete on public.workshops to service_role;


-- ── DROP THE OLD MODE CHECK CONSTRAINT FIRST ──
-- Must happen before normalising the data below — the old
-- constraint only allows the 3-option values, so setting mode to
-- 'Online'/'In-Person' while it's still active would itself violate it.
alter table public.enrolments drop constraint enrolments_mode_check;


-- ── NORMALISE EXISTING ENROLMENT DATA ──
update public.enrolments
  set mode = 'Online'
  where mode in ('Online — Live Sessions', 'Online — Self-paced');

update public.enrolments
  set mode = 'In-Person'
  where mode = 'In-Person — Kigali';


-- ── ADD THE SIMPLIFIED MODE CHECK CONSTRAINT ──
alter table public.enrolments
  add constraint enrolments_mode_check check (mode in ('Online', 'In-Person'));


-- ── LINK AN ENROLMENT TO ITS CHOSEN WORKSHOP ──
-- Null for online enrolments, or an in-person enrolment made before
-- workshop selection existed.
alter table public.enrolments
  add column workshop_id uuid references public.workshops (id) on delete set null;

create index enrolments_workshop_id_idx on public.enrolments (workshop_id);
