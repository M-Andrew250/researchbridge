-- Remembers the last lesson a user opened in an online course, so the
-- learning platform can greet them with "pick up where you left off"
-- next time they arrive, instead of dropping them at a blank state.
alter table public.enrolments
  add column last_lesson_id uuid references public.lessons(id) on delete set null,
  add column last_viewed_at timestamptz;