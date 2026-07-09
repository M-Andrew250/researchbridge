-- Tracks how many times a student has attempted a quiz/exam lesson as
-- a whole, so we can cap retakes at 3 (see server/src/routes/learning.js's
-- submit-quiz route). Per-question retry state (2 tries per question)
-- is intentionally kept client-side only — it's a learning aid, not
-- a graded/security boundary, so it doesn't need persistence here.
alter table public.lesson_progress
  add column quiz_attempts integer not null default 0;