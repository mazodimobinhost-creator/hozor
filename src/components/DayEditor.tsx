import { useMemo, useState } from 'react'
import type { DayRecord, Punch } from '../lib/types'
import { useStore, type DayRange } from '../lib/store'
import { shiftWindow } from '../lib/calc'
import {
  faDigits,
  formatDuration,
  minutesOfDay,
  minutesToTime,
  pad2,
} from '../lib/jalali'
import { Icon } from './Icons'
import { JalaliDatePicker } from './JalaliDatePicker'

const leaveOptions = [
  { value: 0, label: 'بدون مرخصی' },
  { value: 60, label: '۱ ساعت' },
  { value: 120, label: '۲ ساعت' },
  { value: 240, label: '۴ ساعت' },
  { value: 480, label: '۸ ساعت' },
  { value: 540, label: 'تمام روز' },
]

export const ENTRY_LABELS = ['اول', 'دوم', 'سوم', 'چهارم']

function timeOf(iso: string): string {
  const d = new Date(iso)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** turn stored punches into editable in/out ranges */
export function rangesFromPunches(punches: Punch[]): DayRange[] {
  const sorted = [...punches].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  const ranges: DayRange[] = []
  let current: DayRange = {}
  for (const p of sorted) {
    const t = timeOf(p.at)
    if (p.type === 'in') {
      // دو ورود پشت‌سرهم: ورود قبلی (بدون خروج) حفظ می‌شود تا گم نشود
      if (current.in) {
        ranges.push(current)
        current = {}
      }
      current.in = t
    } else if (p.type === 'out') {
      if (current.in) {
        current.out = t
        ranges.push(current)
        current = {}
      }
    }
  }
  if (current.in) ranges.push(current)
  if (ranges.length === 0) return [{ in: '', out: '' }, { in: '', out: '' }]
  if (ranges.length === 1) return [ranges[0], { in: '', out: '' }]
  return ranges
}

export const rangeMinutes = (r: DayRange): number => {
  if (!r.in || !r.out) return 0
  const [ih, im] = r.in.split(':').map(Number)
  const [oh, om] = r.out.split(':').map(Number)
  const diff = oh * 60 + om - (ih * 60 + im)
  // خروج کوچک‌تر از ورود یعنی شیفت تا بامداد روز بعد ادامه دارد
  return diff > 0 ? diff : diff + 1440
}

/** آیا این بازه از نیمه‌شب عبور می‌کند؟ */
const crossesMidnight = (r: DayRange): boolean => {
  if (!r.in || !r.out) return false
  const [ih, im] = r.in.split(':').map(Number)
  const [oh, om] = r.out.split(':').map(Number)
  return oh * 60 + om <= ih * 60 + im
}

interface Props {
  dateISO: string
  record?: DayRecord
  showDatePicker?: boolean
  onChangeDate?: (key: string) => void
  onDone: (msg: string) => void
  weekendDays?: number[]
}

export function DayEditor({
  dateISO,
  record,
  showDatePicker,
  onChangeDate,
  onDone,
  weekendDays = [6],
}: Props) {
  const { saveDay, deleteDay, settings } = useStore()
  const [ranges, setRanges] = useState<DayRange[]>(() => rangesFromPunches(record?.punches ?? []))
  const [leave, setLeave] = useState(record?.leaveMinutes ?? 0)
  const [overtime, setOvertime] = useState(record?.approvedOvertimeMinutes ?? 0)
  const [holiday, setHoliday] = useState(Boolean(record?.holiday))
  const [note, setNote] = useState(record?.note ?? '')
  const [error, setError] = useState('')

  const worked = useMemo(() => ranges.reduce((sum, r) => sum + rangeMinutes(r), 0), [ranges])
  const shift = shiftWindow(settings)
  const required = shift.required
  const maxLeave = Math.max(required, 540)
  const overtimeComputed = holiday
    ? worked
    : Math.max(0, worked + Math.min(leave, required) - required)
  const deficit = holiday || leave >= required ? 0 : Math.max(0, required - worked - leave)

  const updateRange = (index: number, patch: DayRange) => {
    setRanges((list) => list.map((r, i) => (i === index ? { ...r, ...patch } : r)))
    setError('')
  }

  const addRange = () => {
    if (ranges.length >= 4) return
    setRanges((list) => [...list, { in: '', out: '' }])
  }

  const removeRange = (index: number) => {
    setRanges((list) =>
      list.length === 1 ? [{ in: '', out: '' }] : list.filter((_, i) => i !== index),
    )
  }

  const validate = (): string => {
    for (const r of ranges) {
      if ((r.in && !r.out) || (!r.in && r.out))
        return 'برای هر ورود، ساعت خروج همان بازه را هم وارد کنید'
      if (r.in && r.out && r.in === r.out) return 'ساعت خروج نمی‌تواند با ساعت ورود یکی باشد'
    }
    return ''
  }

  const handleSave = () => {
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    saveDay(dateISO, {
      ranges: ranges.filter((r) => r.in && r.out),
      leaveMinutes: leave,
      approvedOvertimeMinutes: overtime,
      holiday,
      note,
    })
    onDone('ثبت این روز ذخیره شد')
  }

  const handleDelete = () => {
    deleteDay(dateISO)
    setRanges([{ in: '', out: '' }, { in: '', out: '' }])
    setLeave(0)
    setOvertime(0)
    setHoliday(false)
    setNote('')
    onDone('اطلاعات این روز پاک شد')
  }

  const hasData = Boolean(
    record && (record.punches.length || record.leaveMinutes || record.note || record.holiday),
  )

  return (
    <div>
      {showDatePicker && onChangeDate && (
        <div className="field">
          <label>روز مورد نظر</label>
          <JalaliDatePicker
            value={dateISO}
            onChange={onChangeDate}
            weekendDays={weekendDays}
            label="تاریخ"
          />
        </div>
      )}

      <div className="section-title" style={{ marginTop: showDatePicker ? 16 : 4 }}>
        <Icon name="clock" size={14} /> ساعت ورود و خروج
      </div>

      <div className="ranges">
        {ranges.map((r, i) => (
          <div className="range-row" key={i}>
            <span className="range-index num">{faDigits(i + 1)}</span>
            <label className="range-cell">
              <span>{i === 0 ? 'ورود' : `ورود ${ENTRY_LABELS[i]}`}</span>
              <input
                className="input num"
                type="time"
                value={r.in ?? ''}
                onChange={(e) => updateRange(i, { in: e.target.value })}
              />
            </label>
            <label className="range-cell">
              <span>
                {i === 0 ? 'خروج' : `خروج ${ENTRY_LABELS[i]}`}
                {crossesMidnight(r) ? ' (بامداد)' : ''}
                {r.in && r.out ? ` · ${formatDuration(rangeMinutes(r))}` : ''}
              </span>
              <input
                className="input num"
                type="time"
                value={r.out ?? ''}
                onChange={(e) => updateRange(i, { out: e.target.value })}
              />
            </label>
            <button
              type="button"
              className="icon-btn range-remove"
              onClick={() => removeRange(i)}
              aria-label="حذف بازه"
            >
              <Icon name="x" size={15} />
            </button>
          </div>
        ))}
      </div>

      <div className="ranges-actions">
        <button type="button" className="btn btn-sm" onClick={addRange} disabled={ranges.length >= 4}>
          <Icon name="plus" size={14} /> ثبت ورود سوم / بیشتر
        </button>
        <span className="tiny muted">
          هر ردیف یک «ورود و خروج» است؛ ورود دوم همان بازگشت بعد از استراحت یا ماموریت است.
        </span>
      </div>

      <div className="day-totals">
        <div className="day-total">
          <span className="k">کارکرد</span>
          <span className="v c-green num">{formatDuration(worked)}</span>
        </div>
        <div className="day-total">
          <span className="k">موظفی روز</span>
          <span className="v num">{formatDuration(required)}</span>
        </div>
        <div className="day-total is-overtime">
          <span className="k">اضافه‌کاری محاسبه‌شده</span>
          <span className="v num">{formatDuration(overtimeComputed)}</span>
        </div>
        <div className="day-total">
          <span className="k">کسر کار</span>
          <span className={`v num ${deficit > 0 ? 'c-red' : ''}`}>{formatDuration(deficit)}</span>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 16 }}>
        <Icon name="coffee" size={14} /> مرخصی، اضافه‌کاری و تعطیلی
      </div>

      <div className="field">
        <label>مرخصی این روز</label>
        <div className="chips-row">
          {leaveOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`btn btn-sm ${leave === option.value ? 'btn-primary' : ''}`}
              onClick={() => setLeave(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="inline-input">
          <input
            className="input num"
            type="number"
            min={0}
            max={maxLeave}
            step={15}
            value={leave}
            onChange={(e) => setLeave(Math.max(0, Number(e.target.value) || 0))}
            aria-label="دقیقه مرخصی"
          />
          <span className="tiny muted">
            دقیقه — معادل {formatDuration(leave)}
            {leave >= required ? ' (تمام روز مرخصی)' : ''}
          </span>
        </div>
      </div>

      <div className="field">
        <label htmlFor="ot-input">اضافه‌کاری تأییدشده</label>
        <div className="inline-input">
          <input
            id="ot-input"
            className="input num"
            type="number"
            min={0}
            step={15}
            value={overtime}
            onChange={(e) => setOvertime(Math.max(0, Number(e.target.value) || 0))}
          />
          <span className="tiny muted">دقیقه — معادل {formatDuration(overtime)}</span>
          {overtimeComputed > 0 && (
            <button
              type="button"
              className="btn btn-sm ot-apply"
              onClick={() => setOvertime(overtimeComputed)}
            >
              استفاده از محاسبه‌شده ({formatDuration(overtimeComputed)})
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        className={`holiday-toggle ${holiday ? 'on' : ''}`}
        onClick={() => setHoliday((value) => !value)}
        aria-pressed={holiday}
      >
        <span className={`switch ${holiday ? 'on' : ''}`} aria-hidden="true" />
        <span className="holiday-text">
          <b>تعطیل رسمی</b>
          <span className="tiny muted">
            کارکرد این روز به‌جای کسر کار، تعطیل‌کاری/اضافه‌کاری حساب می‌شود
          </span>
        </span>
      </button>

      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="note-input">توضیح (اختیاری)</label>
        <input
          id="note-input"
          className="input"
          placeholder="مثلاً: ماموریت، جلسه بیرون از شرکت، مرخصی استعلاجی"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {error && (
        <div className="notice warn" style={{ marginBottom: 10 }}>
          <Icon name="info" size={16} />
          <div>{error}</div>
        </div>
      )}

      <div className="sheet-actions">
        <button type="button" className="btn btn-primary" onClick={handleSave}>
          <Icon name="check" size={16} /> ذخیره این روز
        </button>
        {hasData && (
          <button type="button" className="btn btn-danger" onClick={handleDelete}>
            <Icon name="trash" size={16} /> پاک کردن
          </button>
        )}
      </div>

      {ranges.some(crossesMidnight) && (
        <div className="notice" style={{ marginTop: 10 }}>
          <Icon name="info" size={16} />
          <div>
            بازه‌ای که ساعت خروجش از ورود کوچک‌تر است، «تا بامداد روز بعد» حساب می‌شود و کارکردش به
            همین روز می‌ماند، نه فردا.
          </div>
        </div>
      )}

      <p className="tiny muted" style={{ marginBottom: 0, marginTop: 10 }}>
        ردیف خالی نادیده گرفته می‌شود. برای شیفت شبانه کافی است خروج را بامداد بنویسید (مثلاً ورود
        ۰۸:۰۰ و خروج ۰۴:۰۰).
      </p>
    </div>
  )
}

export { minutesOfDay, minutesToTime }
