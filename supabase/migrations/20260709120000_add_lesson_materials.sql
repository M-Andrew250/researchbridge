-- Lessons move from a single content_url/content_body to a nested
-- list of materials (document/video/image/text), each independently
-- orderable — a lesson like "Data Cleaning Basics" can now hold a
-- video, a PDF handout, a diagram image, and a text note together,
-- instead of forcing one lesson per file.

create table public.lesson_materials (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  title text,
  type text not null check (type in ('document', 'video', 'image', 'text')),
  -- document/image: a Storage bucket path (signed on read) or a full URL.
  -- video: a video URL (e.g. YouTube embed link).
  -- text: content_body holds the text itself; content_url unused.
  content_url text,
  content_body text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lesson_materials enable row level security;

create trigger lesson_materials_set_updated_at
  before update on public.lesson_materials
  for each row execute function public.set_updated_at();

create index lesson_materials_lesson_id_idx on public.lesson_materials (lesson_id);

grant select, insert, update, delete on public.lesson_materials to service_role;


-- ── BACKFILL EXISTING LESSON CONTENT ──
-- Any lesson that already has content_url/content_body becomes its
-- first material, so nothing existing breaks.
insert into public.lesson_materials (lesson_id, type, content_url, content_body, order_index)
select
  id,
  case
    when type = 'video' then 'video'
    when content_url is not null then 'document'
    else 'text'
  end,
  content_url,
  content_body,
  0
from public.lessons
where content_url is not null or content_body is not null;


-- ── DROP THE OLD SINGLE-CONTENT COLUMNS ──
-- Content now lives entirely in lesson_materials.
alter table public.lessons drop column content_url;
alter table public.lessons drop column content_body;