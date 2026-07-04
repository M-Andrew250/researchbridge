-- Remembers how far into a video lesson a user has watched, so the
-- player can resume from that point on their next visit instead of
-- restarting from 0:00. Reuses the existing per-(user, enrolment,
-- lesson) progress row rather than a new table.
alter table public.lesson_progress
  add column last_position_seconds numeric;