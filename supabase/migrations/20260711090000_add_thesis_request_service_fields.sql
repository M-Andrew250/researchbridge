-- Extends thesis_requests for the new 5-tab request wizard
-- (pages/thesis-request.html): what kind of editing work is wanted
-- (service_type), an optional page count alongside word_count, and
-- which payment method the client intends to use (payment_method is
-- informational only — no online payment processing; admin follows
-- up with exact amount and instructions, same as enrolments).
alter table public.thesis_requests
  add column service_type text not null default 'Editing & Proofreading'
    check (service_type in ('Proofreading Only', 'Editing Only', 'Editing & Proofreading', 'Formatting & Referencing Only')),
  add column page_count integer,
  add column payment_method text
    check (payment_method in ('Bank Transfer', 'Mobile Money', 'Other'));