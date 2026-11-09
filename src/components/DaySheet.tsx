import { useEffect } from 'react'
import type { DaySummary, Settings } from '../lib/types'
import {
  faDigits,
  formatDuration,
  formatJalaliLong,
  PERSIAN_WEEKDAYS,
} from '../lib/jalali'
import { Icon } from './Icons'
import { DayEditor } from './DayEditor'
import { useStore } from '../lib/store'

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
  const { records } = useStore()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!summary) return null

  const dateLabel = `${PERSIAN_WEEKDAYS[summary.weekday]} ${formatJalaliLong(new Date(summary.key + 'T00:00:00'))}`

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

        <DayEditor
          key={summary.key}
          dateISO={summary.key}
          record={records[summary.key]}
          onDone={(msg) => {
            onToast(msg)
            onClose()
          }}
          weekendDays={settings.weekendDays}
        />
      </div>
    </div>
  )
}
