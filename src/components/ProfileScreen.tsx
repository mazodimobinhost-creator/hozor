import { useState } from 'react'
import type { Settings } from '../lib/types'
import { useStore } from '../lib/store'
import { PERSIAN_WEEKDAYS, faDigits, formatDuration, timeToMinutes } from '../lib/jalali'
import { Icon } from './Icons'

export function ProfileScreen({ onToast }: { onToast: (msg: string) => void }) {
  const { settings, updateSettings, resetDemo, clearAll } = useStore()
  const [form, setForm] = useState<Settings>(settings)

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const toggleWeekend = (idx: number) => {
    const has = form.weekendDays.includes(idx)
    set(
      'weekendDays',
      has ? form.weekendDays.filter((d) => d !== idx) : [...form.weekendDays, idx].sort(),
    )
  }

  const required =
    timeToMinutes(form.shiftEnd) - timeToMinutes(form.shiftStart) - (form.breakMinutes || 0)

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
                {formatDuration(required)} ساعت
              </div>
            </div>
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
            <div className="notice" style={{ marginTop: 10 }}>
              <Icon name="info" size={16} />
              <div>
                این اپ آفلاین کار می‌کند و همه اطلاعات روی حافظه گوشی خودتان ذخیره می‌شود؛ هر فرد فقط
                سوابق خودش را می‌بیند.
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
              برای دیدن ظاهر تقویم، چند ماه دادهٔ نمونه ثبت شده است. می‌توانید آن را پاک کنید و از امروز
              ثبت واقعی را شروع کنید.
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
