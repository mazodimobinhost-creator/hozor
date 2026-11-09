import { useEffect, useState } from 'react'
import {
  PERSIAN_MONTHS,
  PERSIAN_WEEKDAYS_SHORT,
  dayKey,
  faDigits,
  formatJalaliLong,
  fromJalali,
  monthGrid,
  pad2,
  parseDayKey,
  persianWeekday,
  shiftMonth,
  toJalali,
  weekdayLabel,
} from '../lib/jalali'
import { Icon } from './Icons'

interface Props {
  value: string
  onChange: (key: string) => void
  weekendDays?: number[]
  label?: string
}

export function JalaliDatePicker({ value, onChange, weekendDays = [6], label }: Props) {
  const selected = parseDayKey(value)
  const selectedJ = toJalali(selected)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState({ jy: selectedJ.jy, jm: selectedJ.jm })

  useEffect(() => {
    if (open) setView({ jy: selectedJ.jy, jm: selectedJ.jm })
  }, [open, selectedJ.jy, selectedJ.jm])

  const cells = monthGrid(view.jy, view.jm)
  const todayKey = dayKey(new Date())

  const pick = (date: Date) => {
    onChange(dayKey(date))
    setOpen(false)
  }

  return (
    <>
      <button type="button" className="date-field" onClick={() => setOpen(true)}>
        <Icon name="calendar" size={17} />
        <span>
          {label ? <span className="date-field-label">{label}</span> : null}
          <span className="num">
            {formatJalaliLong(selected)} · {weekdayLabel(persianWeekday(selected))}
          </span>
        </span>
        <Icon name="chevronLeft" size={16} />
      </button>

      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <div className="sheet picker-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="grabber" />
            <div className="sheet-head">
              <div>
                <div className="sheet-title">انتخاب تاریخ</div>
                <div className="sheet-sub">تقویم شمسی</div>
              </div>
              <div className="spacer" />
              <button className="icon-btn" onClick={() => setOpen(false)} aria-label="بستن">
                <Icon name="x" size={18} />
              </button>
            </div>

            <div className="picker-nav">
              <button
                className="icon-btn"
                onClick={() => setView((v) => shiftMonth(v.jy, v.jm, -1))}
                aria-label="ماه قبل"
              >
                <Icon name="chevronRight" size={17} />
              </button>
              <div className="picker-title num">
                {PERSIAN_MONTHS[view.jm - 1]} {faDigits(view.jy)}
              </div>
              <button
                className="icon-btn"
                onClick={() => setView((v) => shiftMonth(v.jy, v.jm, 1))}
                aria-label="ماه بعد"
              >
                <Icon name="chevronLeft" size={17} />
              </button>
            </div>

            <div className="picker-weekdays">
              {PERSIAN_WEEKDAYS_SHORT.map((w) => (
                <span key={w}>{w.replace('‌', '')}</span>
              ))}
            </div>

            <div className="picker-grid">
              {cells.map((date) => {
                const j = toJalali(date)
                const outside = j.jm !== view.jm || j.jy !== view.jy
                const key = dayKey(date)
                return (
                  <button
                    key={key + date.toISOString()}
                    type="button"
                    className={[
                      'picker-day',
                      outside ? 'is-outside' : '',
                      key === todayKey ? 'is-today' : '',
                      key === value ? 'is-selected' : '',
                      weekendDays.includes(persianWeekday(date)) ? 'is-weekend' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => pick(date)}
                  >
                    {faDigits(j.jd)}
                  </button>
                )
              })}
            </div>

            <div className="sheet-actions">
              <button className="btn" onClick={() => pick(new Date())}>
                امروز
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setOpen(false)}
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function todayKey(): string {
  return dayKey(new Date())
}

export function keyFromJalali(jy: number, jm: number, jd: number): string {
  return dayKey(fromJalali(jy, jm, jd))
}

export function jalaliLabel(key: string): string {
  const d = parseDayKey(key)
  const j = toJalali(d)
  return `${faDigits(j.jd)} ${PERSIAN_MONTHS[j.jm - 1]} ${faDigits(j.jy)}`
}

export function isoNum(key: string): string {
  const j = toJalali(parseDayKey(key))
  return faDigits(`${j.jy}/${pad2(j.jm)}/${pad2(j.jd)}`)
}
