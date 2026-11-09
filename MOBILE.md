# ساخت اپ اندروید و آیفون

این پروژه دو مسیر برای رسیدن به گوشی کاربر دارد:

1. **PWA** — همین حالا با باز کردن آدرس سایت، اپ روی صفحه اصلی نصب می‌شود (بدون استور).
2. **اپ نیتیو** — با Capacitor از همان کد، پروژه Android Studio و Xcode ساخته می‌شود.

---

## ۱) نصب سریع روی گوشی (PWA)

**اندروید (Chrome):** باز کردن آدرس ← منوی ⋮ ← «افزودن به صفحه اصلی» / Install app.
**آیفون (Safari):** باز کردن آدرس ← دکمه اشتراک‌گذاری ← «Add to Home Screen».

بعد از نصب، اپ تمام‌صفحه باز می‌شود، آیکون مخصوص خودش را دارد و آفلاین هم کار می‌کند.
برای اینکه آیکون و نوار وضعیت در آیفون درست نمایش داده شود، فایل `public/icons/apple-touch-icon.png` از قبل ساخته شده است.

---

## ۲) ساخت اپ نیتیو اندروید

پیش‌نیازها: Node ۲۰+، JDK 17+، Android Studio (با Android SDK 34+).

```bash
npm install
npm run build                 # خروجی وب در dist/
npx cap add android           # فقط بار اول؛ پوشه android/ ساخته می‌شود
npx cap sync android
npx cap open android          # Android Studio باز می‌شود
```

در Android Studio:

1. صبر کنید Gradle Sync تمام شود.
2. `Build > Build Bundle(s)/APK(s) > Build APK(s)` برای تست، یا
   `Build > Generate Signed Bundle / APK` برای انتشار در Google Play (نیاز به Keystore).
3. فایل خروجی: `android/app/build/outputs/apk/release/app-release.apk`

برای انتشار در Google Play، `AAB` بسازید (همان مسیر، گزینه Android App Bundle).

### شماره نسخه و نام اپ

- `appId`: `ir.hozor.attendance` (در `capacitor.config.ts`)
- نام نمایشی: «حضور و غیاب من»
- نسخه در `android/app/build.gradle` → `versionCode` و `versionName`

### آیکون و اسپلش اندروید

```bash
npm i -D @capacitor/assets
# فایل ۱۰۲۴×۱۰۲۴ را در assets/icon-only.png و اسپلش را در assets/splash.png بگذارید
npx capacitor-assets generate --android
```

---

## ۳) ساخت اپ نیتیو آیفون

پیش‌نیازها: macOS + Xcode 15+، حساب Apple Developer (برای نصب روی دستگاه واقعی یا App Store).

```bash
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios               # Xcode باز می‌شود
```

در Xcode:

1. Target «App» ← Signing & Capabilities ← Team خودتان را انتخاب کنید.
2. Bundle Identifier را در صورت نیاز تغییر دهید (`ir.hozor.attendance`).
3. برای تست: یک شبیه‌ساز انتخاب و ⌘R بزنید.
4. برای انتشار: `Product > Archive` سپس `Distribute App > App Store Connect`.

### نکات iOS

- فایل `Info.plist` را برای متن اجازه دسترسی به موقعیت مکانی تنظیم کنید (اپ الان اختیاری از GPS استفاده می‌کند):

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>برای ثبت موقعیت هنگام ورود و خروج</string>
```

- اگر می‌خواهید بدون App Store نصب شود: Ad Hoc یا TestFlight.

---

## ۴) بعد از هر تغییر کد

```bash
npm run build && npx cap sync
```

سپس در Android Studio / Xcode دوباره Run بزنید. فایل‌های نیتیو (`android/`, `ios/`) در `.gitignore` هستند و از روی همین کد بازتولید می‌شوند.

---

## ۵) گزینه جایگزین: بدون استور، فقط با لینک

اگر سریع‌ترین راه را می‌خواهی: خروجی `dist/` را روی هر هاست استاتیک (Netlify، Vercel، لیارا، آروان…) بگذار و لینک را برای اعضای واحد بفرست. هر کس اپ را روی صفحه اصلی گوشی‌اش نصب می‌کند و فقط سوابق خودش را می‌بیند.
