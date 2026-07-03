-- Tracks whether the one-time welcome email has already been sent,
-- so the SIGNED_IN-triggered check in main.js stays idempotent even
-- if it fires more than once.
alter table public.profiles
  add column welcome_email_sent_at timestamptz;
