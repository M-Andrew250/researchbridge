-- Adds country, marketing opt-in, and consent tracking to both
-- signup (profiles) and the enrolment form (enrolments).
alter table public.profiles
  add column country text,
  add column marketing_opt_in boolean not null default false,
  add column consent_accepted_at timestamptz;

alter table public.enrolments
  add column country text,
  add column marketing_opt_in boolean not null default false,
  add column consent_accepted_at timestamptz;

-- handle_new_user() only copies full_name/phone today — extend it to
-- also pick up country/marketing_opt_in/consent_accepted_at from the
-- signUp() call's options.data metadata (see pages/signup.html).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, country, marketing_opt_in, consent_accepted_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'country',
    coalesce((new.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false),
    case when new.raw_user_meta_data ->> 'consent_accepted_at' is not null
      then (new.raw_user_meta_data ->> 'consent_accepted_at')::timestamptz
      else null
    end
  );
  return new;
end;
$$;
