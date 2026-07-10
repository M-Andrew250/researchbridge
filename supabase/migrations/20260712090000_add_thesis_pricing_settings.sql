-- Admin-editable pricing rates for the Thesis Editing quote
-- calculator on pages/thesis-editing.html. Singleton row (id always
-- 1) since there's exactly one global rate card, not a list.
create table public.thesis_pricing_settings (
  id integer primary key default 1 check (id = 1),
  price_per_page_rwf integer not null default 8000 check (price_per_page_rwf > 0),
  undergrad_multiplier numeric not null default 0.5 check (undergrad_multiplier > 0),
  masters_multiplier numeric not null default 1 check (masters_multiplier > 0),
  phd_multiplier numeric not null default 1.5 check (phd_multiplier > 0),
  deadline_30_multiplier numeric not null default 1 check (deadline_30_multiplier > 0),
  deadline_14_multiplier numeric not null default 1.2 check (deadline_14_multiplier > 0),
  deadline_7_multiplier numeric not null default 1.4 check (deadline_7_multiplier > 0),
  deadline_3_multiplier numeric not null default 1.6 check (deadline_3_multiplier > 0),
  deadline_24h_multiplier numeric not null default 2 check (deadline_24h_multiplier > 0),
  updated_at timestamptz not null default now()
);

insert into public.thesis_pricing_settings (id) values (1);

alter table public.thesis_pricing_settings enable row level security;

create trigger thesis_pricing_settings_set_updated_at
  before update on public.thesis_pricing_settings
  for each row execute function public.set_updated_at();