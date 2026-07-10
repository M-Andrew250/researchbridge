-- Tracks when an online enrolment first reached 100% progress, so
-- the dashboard's certificate can show a real completion date
-- instead of "today" on every view. Stamped lazily by
-- getEnrolmentProgress() the first time it computes 100% for a
-- given enrolment (idempotent — never overwritten once set).
alter table public.enrolments
  add column completed_at timestamptz;
