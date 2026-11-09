import { useMemo, useState } from 'react'
import type { DayRecord, Punch } from '../lib/types'
import { useStore, type DayRange } from '../lib/store'
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
  { value: 540, label: 'تمام روز (۹ ساعت)' },
]

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
      if (current.in && current.out) {
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
  return ranges.length > 0 ? ranges : [{ in: '', out: '' }]
}

const rangeMinutes = (r: DayRange): number => {
  if (!r.in || !r.out) return 0
  const [ih, im] = r.in.split(':').map(Number)
  const [oh, om] = r.out.split(':').map(Number)
  return Math.max(0, oh * 60 + om - (ih * 60 + im))
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
  const { saveDay, deleteDay } = useStore()
  const [ranges, setRanges] = useState<DayRange[]>(() => rangesFromPunches(record?.punches ?? []))
  const [leave, setLeave] = useState(record?.leaveMinutes ?? 0)
  const [overtime, setOvertime] = useState(record?.approvedOvertimeMinutes ?? 0)
  const [note, setNote] = useState(record?.note ?? '')
  const [error, setError] = useState('')

  const worked = useMemo(() => ranges.reduce((sum, r) => sum + rangeMinutes(r), 0), [ranges])

  const updateRange = (index: number, patch: DayRange) => {
    setRanges((list) => list.map((r, i) => (i === index ? { ...r, ...patch } : r)))
    setError('')
  }

  const addRange = () => {
    if (ranges.length >= 4) return
    setRanges((list) => [...list, { in: '', out: '' }])
  }

  const removeRange = (index: number) => {
    setRanges((list) => (list.length === 1 ? [{ in: '', out: '' }] : list.filter((_, i) => i !== index)))
  }

  const validate = (): string => {
    for (const r of ranges) {
      if ((r.in && !r.out) || (!r.in && r.out)) return 'برای هر بازه، هم ساعت ورود و هم خروج را وارد کنید'
      if (r.in && r.out && rangeMinutes(r) === 0) return 'ساعت خروج باید بعد از ساعت ورود باشد'
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
      note,
    })
    onDone('ثبت دستی ذخیره شد')
  }

  const handleDelete = () => {
    deleteDay(dateISO)
    setRanges([{ in: '', out: '' }])
    setLeave(0)
    setOvertime(0)
    setNote('')
    onDone('اطلاعات این روز پاک شد')
  }

  const hasData = Boolean(record && (record.punches.length || record.leaveMinutes || record.note))

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
              <span>ورود</span>
              <input
                className="input num"
                type="time"
                value={r.in ?? ''}
                onChange={(e) => updateRange(i, { in: e.target.value })}
              />
            </label>
            <label className="range-cell">
              <span>خروج</span>
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
          <Icon name="plus" size={14} /> افزودن بازه (مثلاً بعد از استراحت)
        </button>
        <span className="tiny muted num">کارکرد محاسبه‌شده: {formatDuration(worked)}</span>
      </div>

      <div className="row2" style={{ marginTop: 14 }}>
        <div className="field">
          <label htmlFor="leave-select">مرخصی این روز</label>
          <select
            id="leave-select"
            className="select"
            value={leave}
            onChange={(e) => setLeave(Number(e.target.value))}
          >
            {leaveOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ot-input">اضافه‌کاری تاییدشده (دقیقه)</label>
          <input
            id="ot-input"
            className="input num"
            type="number"
            min={0}
            step={15}
            value={overtime}
            onChange={(e) => setOvertime(Number(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="note-input">توضیح (اختیاری)</label>
        <input
          id="note-input"
          className="input"
          placeholder="مثلاً: ماموریت، جلسه بیرون از شرکت، فراموشی ثبت خروج"
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

      <p className="tiny muted" style={{ marginBottom: 0, marginTop: 10 }}>
        هر بازه‌ای که خالی بماند نادیده گرفته می‌شود. اگر شیفت شما بعد از نیمه‌شب تمام می‌شود، بازه را
        در همان روز با ساعت پایانی بنویسید (مثلاً ۰۸:۰۰ تا ۲۰:۰۰).
      </p>
    </div>
  )
}

export { minutesOfDay, minutesToTime }
