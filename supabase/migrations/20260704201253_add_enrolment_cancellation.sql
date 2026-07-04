-- Lets a user stop (cancel) their own enrolment from the dashboard,
-- with an optional note on why. Distinct from an admin cancelling via
-- the Table Editor — both just set status = 'cancelled', but this
-- adds a place to record the reason when the *user* initiates it.
alter table public.enrolments
  add column cancellation_reason text,
  add column cancelled_at timestamptz;