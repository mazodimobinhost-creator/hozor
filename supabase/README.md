# Supabase

پروژه: `hozor-attendance` (ref: `nddpltibyfexvukbcgqi`, منطقه `eu-central-1`)

- `migrations/20261109000000_attendance_schema_with_rls.sql` — جدول‌ها، RLS و تریگرها
- تابع لبه‌ای `fetch-file` — پروکسی دریافت فایل اکسل از لینک برای صفحهٔ ایمپورت

## متغیرهای محیطی کلاینت
در Vercel (Settings → Environment Variables) این دو مقدار را بگذارید؛ اگر نگذارید، مقادیر پیش‌فرض
داخل `src/lib/supabase.ts` استفاده می‌شود (کلید anon عمومی است و امنیت با RLS تأمین می‌شود):

```
VITE_SUPABASE_URL=https://nddpltibyfexvukbcgqi.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

## احراز هویت
- ورود با ایمیل و رمز
- تأیید ایمیل خاموش است (بدون نیاز به SMTP) — برای روشن کردنش `mailer_autoconfirm` را false کنید
- آدرس‌های مجاز بازگشت: `https://hozor-nine.vercel.app/**`, `http://localhost:5173`, `http://localhost:4173`,
  `capacitor://localhost`, `https://localhost` (برای اپ اندروید)
