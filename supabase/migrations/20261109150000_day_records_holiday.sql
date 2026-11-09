-- تعطیل رسمی (غیر از تعطیلی هفتگی): کارکرد این روز به‌عنوان تعطیل‌کاری/اضافه‌کاری حساب می‌شود
alter table public.day_records
  add column if not exists holiday boolean not null default false;

comment on column public.day_records.holiday is 'تعطیل رسمی؛ کارکرد این روز اضافه‌کاری حساب می‌شود';
