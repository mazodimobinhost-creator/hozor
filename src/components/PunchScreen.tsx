import { useEffect, useState } from 'react'
import type { Settings } from '../lib/types'
import { useStore } from '../lib/store'
import { attendanceDayKey, buildSummary, shiftWindow } from '../lib/calc'
import {
  dayKey,
  parseDayKey,
  faDigits,
  formatClock,
  formatDuration,
  formatDuration as dur,
  formatJalaliLong,
  PERSIAN_WEEKDAYS,
  persianWeekday,
} from '../lib/jalali'
import { Icon } from './Icons'

export function PunchScreen({
  settings,
  onToast,
}: {
  settings: Settings
  onToast: (msg: string) => void
}) {
  const { records, punch, removeLastPunch } = useStore()
  const [now, setNow] = useState(new Date())
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null)
  const [geoError, setGeoError] = useState('')

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const shift = shiftWindow(settings)
  const key = attendanceDayKey(now, settings)
  const today = parseDayKey(key)
  const summary = buildSummary(today, records[key], settings, now)
  const last = summary.punches[summary.punches.length - 1]
  const nextType: 'in' | 'out' = !last || last.type === 'out' ? 'in' : 'out'
  const isWeekend = settings.weekendDays.includes(persianWeekday(today))

  const askLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('این دستگاه از موقعیت مکانی پشتیبانی نمی‌کند')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGeoError('')
      },
      () => setGeoError('دسترسی به موقعیت مکانی رد شد'),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  const handlePunch = () => {
    punch(nextType, new Date())
    askLocation()
    onToast(
      nextType === 'in'
        ? `ورود در ساعت ${formatClock(new Date())} ثبت شد`
        : `خروج در ساعت ${formatClock(new Date())} ثبت شد`,
    )
  }

  return (
    <div className="punch-wrap">
      <div className="punch-main">
        <div className="live-clock num">{formatClock(now, true)}</div>
        <div className="live-date">
          {PERSIAN_WEEKDAYS[persianWeekday(today)]} · {formatJalaliLong(today)}
          {shift.overnight ? ' · شیفت شبانه (تا بامداد روز بعد)' : ''}
        </div>

        <button className={`punch-btn ${nextType === 'out' ? 'is-out' : ''}`} onClick={handlePunch}>
          <span className="pulse-ring" />
          <span className="punch-btn-inner">
            <Icon name={nextType === 'in' ? 'login' : 'logout'} size={30} />
            <span className="punch-btn-title">{nextType === 'in' ? 'ثبت ورود' : 'ثبت خروج'}</span>
            <span className="punch-btn-sub num">{formatClock(now)}</span>
          </span>
        </button>

        <div className="punch-hint">
          {nextType === 'in'
            ? 'برای شروع کار، دکمه را فشار دهید. ورود و خروج فقط از حساب خودتان ثبت می‌شود.'
            : 'شیفت شما تا ساعت ' +
              faDigits(settings.shiftEnd) +
              (shift.overnight ? ' بامداد روز بعد' : '') +
              ' است. با زدن دکمه، خروج همین شیفت ثبت می‌شود.'}
          {isWeekend && ' امروز روز تعطیل است؛ ثبت کار در روز تعطیل به‌عنوان تعطیل‌کاری محاسبه می‌شود.'}
        </div>

        <div className="timeline">
          <div className="section-title" style={{ alignSelf: 'flex-start' }}>
            <Icon name="clock" size={14} /> ثبت‌های امروز
          </div>
          {summary.punches.length === 0 && (
            <div className="tiny muted">هنوز ثبت ورودی برای امروز انجام نشده است.</div>
          )}
          {summary.punches.map((p, i) => (
            <div className="tl-item" key={i}>
              <span className={`tl-dot ${p.type === 'out' ? 'out' : ''}`} />
              <span className="tl-label">{p.type === 'in' ? 'ورود' : 'خروج'}</span>
              <span className={`tl-time num ${p.type === 'in' ? 'c-teal' : 'c-red'}`}>
                {formatClock(new Date(p.at))}
              </span>
            </div>
          ))}
          {summary.punches.length > 0 && (
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 8, alignSelf: 'flex-start' }} onClick={() => {
              removeLastPunch()
              onToast('آخرین ثبت امروز حذف شد')
            }}>
              <Icon name="x" size={14} /> حذف آخرین ثبت
            </button>
          )}
        </div>
      </div>

      <div className="side-col">
        <div className="card">
          <div className="card-head">
            <div className="card-title">خلاصه امروز</div>
            <div className="spacer" />
            <span className={`chip ${summary.status === 'open' ? 'chip-orange' : 'chip-gray'}`}>
              {summary.status === 'open' ? 'در حال کار' : summary.punches.length ? 'پایان کار' : 'ثبت نشده'}
            </span>
          </div>
          <div className="card-body">
            <div className="kv">
              <span className="kv-k">ساعت ورود</span>
              <span className="kv-v c-teal">
                {summary.firstIn ? formatClock(new Date(summary.firstIn)) : '—'}
              </span>
            </div>
            <div className="kv">
              <span className="kv-k">ساعت خروج</span>
              <span className="kv-v c-red">
                {summary.lastOut ? formatClock(new Date(summary.lastOut)) : '—'}
              </span>
            </div>
            <div className="kv">
              <span className="kv-k">کارکرد تا این لحظه</span>
              <span className="kv-v c-green">{formatDuration(summary.workedMinutes)}</span>
            </div>
            <div className="kv">
              <span className="kv-k">تاخیر</span>
              <span className="kv-v c-orange">
                {summary.lateMinutes > 0 ? `${faDigits(summary.lateMinutes)} دقیقه` : 'ندارد'}
              </span>
            </div>
            <div className="kv">
              <span className="kv-k">اضافه‌کاری امروز</span>
              <span className="kv-v c-violet">{formatDuration(summary.overtimeMinutes)}</span>
            </div>
            <div className="kv">
              <span className="kv-k">شیفت کاری</span>
              <span className="kv-v num">
                {faDigits(settings.shiftStart)} — {faDigits(settings.shiftEnd)}
                {shift.overnight ? ' (روز بعد)' : ''}
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">موقعیت مکانی</div>
            <div className="spacer" />
            <button className="btn btn-sm" onClick={askLocation}>
              <Icon name="pin" size={14} /> ثبت موقعیت
            </button>
          </div>
          <div className="card-body" style={{ paddingTop: 12 }}>
            {geo ? (
              <div className="notice">
                <Icon name="check" size={16} />
                <div>
                  موقعیت ثبت شد: عرض <span className="num">{faDigits(geo.lat.toFixed(4))}</span> · طول{' '}
                  <span className="num">{faDigits(geo.lng.toFixed(4))}</span>
                </div>
              </div>
            ) : (
              <div className={`notice ${geoError ? 'warn' : ''}`}>
                <Icon name="info" size={16} />
                <div>
                  {geoError ||
                    'ثبت موقعیت اختیاری است؛ محدودیت مکانی اعمال نمی‌شود و می‌توانید از هر جایی ورود و خروج بزنید.'}
                </div>
              </div>
            )}
            <div className="kv" style={{ marginTop: 6 }}>
              <span className="kv-k">ساعت کاری موظفی</span>
              <span className="kv-v num">
                {dur(shift.required)} ساعت
              </span>
            </div>
            <div className="kv">
              <span className="kv-k">آخرین همگام‌سازی</span>
              <span className="kv-v num">{formatClock(now)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
