import { useEffect, useState } from 'react'
import type { DaySummary, Settings } from '../lib/types'
import { useStore } from '../lib/store'
import {
  faDigits,
  formatDuration,
  formatJalaliLong,
  minutesOfDay,
  minutesToTime,
  pad2,
  parseDayKey,
  PERSIAN_WEEKDAYS,
} from '../lib/jalali'
import { Icon } from './Icons'

const leaveOptions = [
  { value: 0, label: 'بدون مرخصی' },
  { value: 60, label: '۱ ساعت' },
  { value: 120, label: '۲ ساعت' },
  { value: 240, label: '۴ ساعت' },
  { value: 540, label: 'تمام روز (۹ ساعت)' },
]

export function DaySheet({
  summary,
  settings,
  onClose,
  onToast,
}: {
  summary: DaySummary | null
  settings: Settings
  onClose: () => void
  onToast: (msg: string) => void
}) {
  const { saveManualDay, setLeave, setApprovedOvertime, deleteDay } = useStore()
  const [inTime, setInTime] = useState('')
  const [outTime, setOutTime] = useState('')
  const [leave, setLeaveValue] = useState(0)
  const [overtime, setOvertime] = useState(0)

  useEffect(() => {
    if (!summary) return
    setInTime(summary.firstIn ? minutesToTime(minutesOfDay(new Date(summary.firstIn))) : '')
    setOutTime(summary.lastOut ? minutesToTime(minutesOfDay(new Date(summary.lastOut))) : '')
    setLeaveValue(summary.leaveMinutes)
    setOvertime(summary.approvedOvertimeMinutes)
  }, [summary])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!summary) return null

  const date = parseDayKey(summary.key)
  const dateLabel = `${PERSIAN_WEEKDAYS[summary.weekday]} ${formatJalaliLong(date)}`

  const handleSave = () => {
    saveManualDay(summary.key, inTime || undefined, outTime || undefined)
    setLeave(summary.key, leave)
    setApprovedOvertime(summary.key, overtime)
    onToast('تغییرات روز ذخیره شد')
    onClose()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="grabber" />
        <div className="sheet-head">
          <div>
            <div className="sheet-title">{dateLabel}</div>
            <div className="sheet-sub num">
              شیفت {faDigits(settings.shiftStart)} تا {faDigits(settings.shiftEnd)} · وضعیت:{' '}
              {summary.isWeekend ? 'روز تعطیل' : 'روز کاری'}
            </div>
          </div>
          <div className="spacer" />
          <button className="icon-btn" onClick={onClose} aria-label="بستن">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="row2" style={{ marginBottom: 14 }}>
          <div className="pill pill-green num" style={{ padding: '9px 10px', fontSize: 12 }}>
            کارکرد {formatDuration(summary.workedMinutes)}
          </div>
          <div className="pill pill-violet num" style={{ padding: '9px 10px', fontSize: 12 }}>
            اضافه‌کاری {formatDuration(summary.overtimeMinutes)}
          </div>
        </div>

        <div className="row2">
          <div className="field">
            <label htmlFor="in-time">ساعت ورود</label>
            <input
              id="in-time"
              className="input num"
              type="time"
              value={inTime}
              onChange={(e) => setInTime(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="out-time">ساعت خروج</label>
            <input
              id="out-time"
              className="input num"
              type="time"
              value={outTime}
              onChange={(e) => setOutTime(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="leave">مرخصی این روز</label>
          <select
            id="leave"
            className="select"
            value={leave}
            onChange={(e) => setLeaveValue(Number(e.target.value))}
          >
            {leaveOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="ot">اضافه‌کاری تاییدشده (دقیقه)</label>
          <input
            id="ot"
            className="input num"
            type="number"
            min={0}
            step={15}
            value={overtime}
            onChange={(e) => setOvertime(Number(e.target.value) || 0)}
          />
          <span className="tiny muted num">
            معادل {formatDuration(overtime)} ساعت — حداکثر اضافه‌کاری محاسبه‌شده:{' '}
            {formatDuration(summary.overtimeMinutes)}
          </span>
        </div>

        {summary.punches.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div className="section-title">ثبت‌های این روز</div>
            {summary.punches.map((p, i) => (
              <div className="kv" key={i}>
                <span className="kv-k">
                  {p.type === 'in' ? 'ورود' : 'خروج'} ·{' '}
                  {p.source === 'mobile' ? 'اپ موبایل' : p.source === 'manual' ? 'ثبت دستی' : 'وب'}
                </span>
                <span
                  className={`kv-v num ${p.type === 'in' ? 'c-teal' : 'c-red'}`}
                >
                  {faDigits(
                    `${pad2(new Date(p.at).getHours())}:${pad2(new Date(p.at).getMinutes())}`,
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="sheet-actions">
          <button className="btn btn-primary" onClick={handleSave}>
            <Icon name="check" size={16} /> ذخیره
          </button>
          <button
            className="btn btn-danger"
            onClick={() => {
              deleteDay(summary.key)
              onToast('اطلاعات این روز پاک شد')
              onClose()
            }}
          >
            <Icon name="trash" size={16} /> پاک کردن
          </button>
        </div>
      </div>
    </div>
  )
}
