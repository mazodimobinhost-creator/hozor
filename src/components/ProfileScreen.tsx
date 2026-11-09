import { useEffect, useState } from 'react'
import type { Settings } from '../lib/types'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { PERSIAN_WEEKDAYS, faDigits, formatDuration } from '../lib/jalali'
import { shiftWindow } from '../lib/calc'
import { Icon } from './Icons'
import { UpdateCard } from './UpdateCard'
import { DownloadCard } from './DownloadCard'

export function ProfileScreen({ onToast }: { onToast: (msg: string) => void }) {
  const { settings, updateSettings, resetDemo, clearAll, serverState, refresh } = useStore()
  const { email, signOut, updatePassword } = useAuth()
  const [form, setForm] = useState<Settings>(settings)
  const [newPassword, setNewPassword] = useState('')

  // وقتی داده‌های حساب از سرور می‌رسد، فرم را هم‌سان کن
  useEffect(() => {
    setForm(settings)
  }, [settings])
  const [passMsg, setPassMsg] = useState('')

  const syncLabel =
    serverState === 'saved'
      ? 'همگام با سرور'
      : serverState === 'syncing'
        ? 'در حال همگام‌سازی…'
        : serverState === 'offline'
          ? 'آفلاین — تغییرات در صف'
          : 'آماده'

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const toggleWeekend = (idx: number) => {
    const has = form.weekendDays.includes(idx)
    set(
      'weekendDays',
      has ? form.weekendDays.filter((d) => d !== idx) : [...form.weekendDays, idx].sort(),
    )
  }

  const required = shiftWindow(form).required
  const overnight = shiftWindow(form).overnight

  const save = () => {
    updateSettings(form)
    onToast('تنظیمات ذخیره شد')
  }

  return (
    <div className="report-grid">
      <section className="card">
        <div className="card-head">
          <div className="card-title">مشخصات و شیفت کاری</div>
          <div className="spacer" />
          <span className="chip chip-gray">پروفایل من</span>
        </div>
        <div className="card-body">
          <div className="row2">
            <div className="field">
              <label htmlFor="fullName">نام و نام خانوادگی</label>
              <input
                id="fullName"
                className="input"
                value={form.fullName}
                onChange={(e) => set('fullName', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="jobTitle">عنوان شغلی</label>
              <input
                id="jobTitle"
                className="input"
                value={form.jobTitle}
                onChange={(e) => set('jobTitle', e.target.value)}
              />
            </div>
          </div>

          <div className="row2">
            <div className="field">
              <label htmlFor="unit">واحد سازمانی</label>
              <input
                id="unit"
                className="input"
                value={form.unit}
                onChange={(e) => set('unit', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="org">سازمان</label>
              <input
                id="org"
                className="input"
                value={form.org}
                onChange={(e) => set('org', e.target.value)}
              />
            </div>
          </div>

          <div className="row2">
            <div className="field">
              <label htmlFor="shiftStart">شروع شیفت</label>
              <input
                id="shiftStart"
                className="input num"
                type="time"
                value={form.shiftStart}
                onChange={(e) => set('shiftStart', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="shiftEnd">پایان شیفت</label>
              <input
                id="shiftEnd"
                className="input num"
                type="time"
                value={form.shiftEnd}
                onChange={(e) => set('shiftEnd', e.target.value)}
              />
            </div>
          </div>

          <div className="row2">
            <div className="field">
              <label htmlFor="breakMinutes">استراحت روزانه (دقیقه)</label>
              <input
                id="breakMinutes"
                className="input num"
                type="number"
                min={0}
                step={5}
                value={form.breakMinutes}
                onChange={(e) => set('breakMinutes', Number(e.target.value) || 0)}
              />
            </div>
            <div className="field">
              <label>ساعت موظفی روزانه</label>
              <div className="input num" style={{ display: 'flex', alignItems: 'center' }}>
                {formatDuration(required)} ساعت{overnight ? ' (شبانه)' : ''}
              </div>
            </div>
          </div>

          <div className="field">
            <label>شیفت‌های آماده</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { label: '۰۸ تا ۱۷', s: '08:00', e: '17:00' },
                { label: '۰۸ تا ۱۶', s: '08:00', e: '16:00' },
                { label: '۰۸ تا ۲۰', s: '08:00', e: '20:00' },
                { label: 'شیفت شبانه ۰۸ تا ۰۴', s: '08:00', e: '04:00' },
              ].map((p) => (
                <button
                  key={p.label}
                  className={`btn btn-sm ${
                    form.shiftStart === p.s && form.shiftEnd === p.e ? 'btn-primary' : ''
                  }`}
                  onClick={() => {
                    set('shiftStart', p.s)
                    set('shiftEnd', p.e)
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {overnight && (
              <span className="tiny muted">
                ساعت پایان کوچک‌تر از شروع است؛ یعنی شیفت تا بامداد روز بعد ادامه دارد و همان روز
                محاسبه می‌شود.
              </span>
            )}
          </div>

          <div className="field">
            <label>روزهای تعطیل هفته</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PERSIAN_WEEKDAYS.map((w, i) => {
                const active = form.weekendDays.includes(i)
                return (
                  <button
                    key={w}
                    onClick={() => toggleWeekend(i)}
                    className={`btn btn-sm ${active ? 'btn-primary' : ''}`}
                  >
                    {w}
                  </button>
                )
              })}
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 12 }} onClick={save}>
            <Icon name="check" size={16} /> ذخیره تنظیمات
          </button>
        </div>
      </section>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <section className="card">
          <div className="card-head">
            <div className="card-title">حساب کاربری</div>
            <div className="spacer" />
            <span
              className={`chip ${
                serverState === 'offline'
                  ? 'chip-orange'
                  : serverState === 'syncing'
                    ? 'chip-blue'
                    : 'chip-green'
              }`}
            >
              {syncLabel}
            </span>
          </div>
          <div className="card-body">
            <div className="kv">
              <span className="kv-k">ایمیل</span>
              <span className="kv-v tiny num" dir="ltr">
                {email || '—'}
              </span>
            </div>
            <div className="kv">
              <span className="kv-k">دسترسی</span>
              <span className="kv-v tiny">
                فقط سوابق خودم — به‌صورت رمزگذاری‌شده روی سرور و جدا از بقیه کاربران
              </span>
            </div>

            <div className="field" style={{ marginTop: 10 }}>
              <label htmlFor="new-pass">تغییر رمز عبور</label>
              <div className="auth-pass">
                <input
                  id="new-pass"
                  className="input auth-ltr"
                  type="password"
                  dir="ltr"
                  autoComplete="new-password"
                  placeholder="رمز جدید (حداقل ۶ کاراکتر)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    if (newPassword.length < 6) {
                      setPassMsg('رمز باید حداقل ۶ کاراکتر باشد.')
                      return
                    }
                    void updatePassword(newPassword)
                      .then(() => {
                        setPassMsg('رمز عبور تغییر کرد.')
                        setNewPassword('')
                      })
                      .catch(() => setPassMsg('تغییر رمز انجام نشد. دوباره وارد شوید.'))
                  }}
                >
                  ذخیره
                </button>
              </div>
              {passMsg && <span className="tiny muted">{passMsg}</span>}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              <button className="btn btn-sm" onClick={() => void refresh()}>
                <Icon name="cloud" size={15} /> به‌روزرسانی از سرور
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => {
                  if (!window.confirm('از حساب خارج می‌شوید؟ داده‌ها روی سرور محفوظ می‌ماند.')) return
                  void signOut()
                }}
              >
                <Icon name="logout" size={15} /> خروج از حساب
              </button>
            </div>
          </div>
        </section>

        <UpdateCard onToast={onToast} />
        <DownloadCard onToast={onToast} />

        <section className="card">
          <div className="card-head">
            <div className="card-title">نصب روی گوشی</div>
          </div>
          <div className="card-body">
            <div className="kv">
              <span className="kv-k">اندروید (Chrome)</span>
              <span className="kv-v tiny">منو ⋮ ← افزودن به صفحه اصلی</span>
            </div>
            <div className="kv">
              <span className="kv-k">آیفون (Safari)</span>
              <span className="kv-v tiny">اشتراک‌گذاری ← Add to Home Screen</span>
            </div>
            <div className="kv">
              <span className="kv-k">نسخه اندروید/iOS با کد نیتیو</span>
              <span className="kv-v tiny">Capacitor — راهنما در فایل MOBILE.md</span>
            </div>
            <div className="kv">
              <span className="kv-k">لینک دائمی اپ</span>
              <span className="kv-v tiny num">mazodimobinhost-creator.github.io/hozor</span>
            </div>

            <div className="notice" style={{ marginTop: 10 }}>
              <Icon name="lock" size={16} />
              <div>
                سوابق شما روی سرور امن ذخیره می‌شود و فقط با حساب خودتان قابل دیدن است؛ بدون اینترنت
                هم ثبت‌ها روی گوشی می‌مانند و بعد از وصل شدن همگام می‌شوند.
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div className="card-title">دادهٔ نمونه و پاک‌سازی</div>
          </div>
          <div className="card-body">
            <p className="tiny muted" style={{ marginTop: 0 }}>
              اگر می‌خواهید ظاهر تقویم را با داده‌های نمونه ببینید، اینجا می‌توانید چند ماه داده نمونه
              اضافه کنید یا همه ثبت‌ها را پاک کنید.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn"
                onClick={() => {
                  resetDemo()
                  onToast('دادهٔ نمونه بازنشانی شد')
                }}
              >
                بازنشانی دادهٔ نمونه
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  clearAll()
                  onToast('همه ثبت‌ها پاک شد')
                }}
              >
                <Icon name="trash" size={15} /> پاک کردن همه ثبت‌ها
              </button>
            </div>
          </div>
        </section>

        <div className="notice">
          <Icon name="userCircle" size={16} />
          <div>
            <b>{settings.fullName}</b> — {settings.jobTitle} · {settings.unit}
            <br />
            دسترسی: فقط سوابق خودم ({faDigits(settings.weekendDays.length)} روز تعطیل هفتگی)
          </div>
        </div>
      </div>
    </div>
  )
}
