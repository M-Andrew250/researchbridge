-- Online learning platform for enrolments with mode = 'Online'.
-- Structure: course_modules → lessons (document/video/exercise/exam)
-- → quiz_questions → quiz_options (for exercise/exam lessons).
-- lesson_progress tracks each user's completion per lesson within a
-- specific enrolment, which drives the progress-ring percentage.

-- ── COURSE MODULES ──
-- Admin-managed via the Table Editor, same pattern as workshops.
create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_slug text not null,
  title text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.course_modules enable row level security;
create trigger course_modules_set_updated_at
  before update on public.course_modules
  for each row execute function public.set_updated_at();
create index course_modules_course_slug_idx on public.course_modules (course_slug);


-- ── LESSONS ──
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules (id) on delete cascade,
  title text not null,
  type text not null check (type in ('document', 'video', 'exercise', 'exam')),
  order_index integer not null default 0,
  -- document: a link to read, or content_body holds inline text.
  -- video: a video URL (e.g. YouTube embed link).
  -- exercise/exam: content_url/content_body optional intro text;
  -- the actual questions live in quiz_questions below.
  content_url text,
  content_body text,
  -- percent score required to pass an exercise/exam.
  pass_threshold integer not null default 70,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lessons enable row level security;
create trigger lessons_set_updated_at
  before update on public.lessons
  for each row execute function public.set_updated_at();
create index lessons_module_id_idx on public.lessons (module_id);


-- ── QUIZ QUESTIONS & OPTIONS ──
-- Single-correct-answer multiple choice.
create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  question_text text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.quiz_questions enable row level security;
create index quiz_questions_lesson_id_idx on public.quiz_questions (lesson_id);

create table public.quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  option_text text not null,
  is_correct boolean not null default false,
  order_index integer not null default 0
);

alter table public.quiz_options enable row level security;
create index quiz_options_question_id_idx on public.quiz_options (question_id);


-- ── LESSON PROGRESS ──
-- One row per (user, enrolment, lesson). completed=true once a
-- document/video is marked done, or a quiz has been submitted
-- (regardless of pass/fail — quiz_passed tracks mastery separately).
create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  enrolment_id uuid not null references public.enrolments (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  completed boolean not null default false,
  quiz_score integer,
  quiz_passed boolean,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, enrolment_id, lesson_id)
);

alter table public.lesson_progress enable row level security;
create trigger lesson_progress_set_updated_at
  before update on public.lesson_progress
  for each row execute function public.set_updated_at();
create index lesson_progress_user_id_idx on public.lesson_progress (user_id);
create index lesson_progress_enrolment_id_idx on public.lesson_progress (enrolment_id);
create index lesson_progress_lesson_id_idx on public.lesson_progress (lesson_id);


-- ── GRANTS ──
grant select, insert, update, delete
  on public.course_modules, public.lessons, public.quiz_questions,
     public.quiz_options, public.lesson_progress
  to service_role;
