-- ساختار پایه اپ حضور و غیاب روی Supabase
-- (این فایل همان چیزی است که روی پروژه nddpltibyfexvukbcgqi اجرا شده است)

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  job_title text,
  unit text,
  org text,
  shift_start text default '08:00',
  shift_end text default '04:00',
  break_minutes integer default 0,
  weekend_days integer[] default '{6}',
  role text default 'employee' check (role in ('employee', 'manager')),
  manager_id uuid references public.profiles (id),
  monthly_leave_minutes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.day_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  punches jsonb not null default '[]'::jsonb,
  leave_minutes integer,
  meeting_minutes integer,
  approved_overtime_minutes integer,
  note text,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

create index if not exists day_records_user_day_idx on public.day_records (user_id, day desc);
create index if not exists profiles_manager_idx on public.profiles (manager_id);

alter table public.profiles enable row level security;
alter table public.day_records enable row level security;

-- هر کاربر فقط ردیف‌های خودش
create policy profiles_select_own on public.profiles for select using (id = auth.uid());
create policy profiles_insert_own on public.profiles for insert with check (id = auth.uid());
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_select_team on public.profiles for select using (manager_id = auth.uid());

create policy records_select_own on public.day_records for select using (user_id = auth.uid());
create policy records_insert_own on public.day_records for insert with check (user_id = auth.uid());
create policy records_update_own on public.day_records for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy records_delete_own on public.day_records for delete using (user_id = auth.uid());
create policy records_select_team on public.day_records for select using (
  exists (select 1 from public.profiles p where p.id = day_records.user_id and p.manager_id = auth.uid())
);

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.day_records to authenticated;

-- پروفایل خودکار برای هر کاربر تازه
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profiles (id, full_name, unit, org)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'unit', ''),
    coalesce(new.raw_user_meta_data->>'org', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists records_touch on public.day_records;
create trigger records_touch before update on public.day_records
  for each row execute function public.touch_updated_at();
