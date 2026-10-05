create table public.anne_katz_mealtrain_signups (
 id uuid primary key,
 full_name text not null check (length(trim(full_name)) between 1 and 120),
 meal_type text not null check (meal_type in ('homecooked','restaurant')),
 signup_dates date[] not null check (cardinality(signup_dates) between 1 and 4 and signup_dates <@ array['2026-10-10','2026-10-14','2026-10-18','2026-10-22']::date[] and array_position(signup_dates,null) is null),
 email text not null check (length(email) between 3 and 254 and position('@' in email) > 1),
 phone text not null check (length(phone) between 10 and 40),
 comment text not null default '' check (length(comment) <= 5000),
 created_at timestamptz not null default now(),
 email_notified_at timestamptz
);
alter table public.anne_katz_mealtrain_signups enable row level security;
revoke all on public.anne_katz_mealtrain_signups from anon, authenticated;
grant select (full_name, signup_dates) on public.anne_katz_mealtrain_signups to anon, authenticated;
grant insert (id, full_name, meal_type, signup_dates, email, phone, comment) on public.anne_katz_mealtrain_signups to anon, authenticated;
create policy anne_katz_mealtrain_read_names on public.anne_katz_mealtrain_signups for select to anon, authenticated using (true);
create policy anne_katz_mealtrain_submit on public.anne_katz_mealtrain_signups for insert to anon, authenticated with check (true);
