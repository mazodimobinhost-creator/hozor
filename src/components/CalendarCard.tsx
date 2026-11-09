import type { DayRecord, DaySummary, Settings } from '../lib/types'
import { buildSummary, statusLabel } from '../lib/calc'
import {
  PERSIAN_WEEKDAYS_SHORT,
  dayKey,
  faDigits,
  formatDuration,
  formatJalaliLong,
  monthGrid,
  monthLength,
  minutesToTime,
  minutesOfDay,
  toJalali,
} from '../lib/jalali'

interface Props {
  jy: number
  jm: number
  records: Record<string, DayRecord>
  settings: Settings
  now: Date
  onSelect: (summary: DaySummary) => void
}

function timeFa(iso?: string): string {
  if (!iso) return '—'
  return faDigits(minutesToTime(minutesOfDay(new Date(iso))))
}

/** total presence span from first in to last out */
function presenceSpan(d: DaySummary): number {
  if (!d.firstIn || !d.lastOut) return 0
  const a = minutesOfDay(new Date(d.firstIn))
  const b = minutesOfDay(new Date(d.lastOut))
  return Math.max(0, b - a)
}

function CellBody({
  d,
  shift,
  compact,
}: {
  d: DaySummary
  shift: { start: string; end: string }
  compact?: boolean
}) {
  if (d.isFuture && d.punches.length === 0 && !d.leaveMinutes) {
    return <div className="day-empty-note">—</div>
  }
  if (d.isWeekend && d.punches.length === 0) {
    return <div className="day-empty-note">تعطیل</div>
  }
  if (d.punches.length === 0 && !d.leaveMinutes) {
    return <div className="day-empty-note">ثبت نشده</div>
  }

  return (
    <>
      <div className="pill pill-shift num">
        {faDigits(shift.start)} — {faDigits(shift.end)}
      </div>

      {d.firstIn && (
        <div className="punch-row">
          <span className="punch-time-in num">{timeFa(d.firstIn)}</span>
          <span className="punch-tag">ورود</span>
        </div>
      )}
      {d.lastOut && (
        <div className="punch-row out">
          <span className="punch-time-out num">{timeFa(d.lastOut)}</span>
          <span className="punch-tag out">خروج</span>
        </div>
      )}

      {d.leaveMinutes > 0 && (
        <div className="pill pill-blue num">مرخصی {formatDuration(d.leaveMinutes)}</div>
      )}

      {d.workedMinutes > 0 && (
        <div className="pill pill-green num">
          <span>{formatDuration(d.workedMinutes)}</span>
        </div>
      )}

      {d.deficitMinutes > 0 && (
        <div className="pill pill-red num">
          <span>کسر {formatDuration(d.deficitMinutes)}</span>
        </div>
      )}

      {!compact && d.lateMinutes > 0 && (
        <div className="mini-note">
          <span>تاخیر {faDigits(d.lateMinutes)} دقیقه</span>
        </div>
      )}
      {!compact && d.approvedOvertimeMinutes > 0 && (
        <div className="mini-note">
          <span>اضافه‌کاری تاییدشده {formatDuration(d.approvedOvertimeMinutes)}</span>
        </div>
      )}
      {!compact && d.meetingMinutes > 0 && (
        <div className="mini-note">
          <span>کسر جلسه {formatDuration(d.meetingMinutes)}</span>
        </div>
      )}
      {d.missingOut && (
        <div className="mini-note">
          <span className="warn-note">خروج ثبت نشده</span>
        </div>
      )}
    </>
  )
}

export function CalendarCard({ jy, jm, records, settings, now, onSelect }: Props) {
  const cells = monthGrid(jy, jm)
  const inMonthCount = monthLength(jy, jm)

  return (
    <section className="card calendar">
      <div className="card-head">
        <div className="card-title">تقویم ماهانه</div>
        <span className="chip chip-gray num">{faDigits(inMonthCount)} روز</span>
        <div className="spacer" />
        <div className="tiny muted">روی هر روز بزنید تا جزئیات، ثبت دستی و مرخصی را ببینید</div>
      </div>

      <div className="weekdays">
        {PERSIAN_WEEKDAYS_SHORT.map((w, i) => (
          <div key={w} className={`weekday ${settings.weekendDays.includes(i) ? 'is-weekend' : ''}`}>
            {w}
          </div>
        ))}
      </div>

      <div className="grid">
        {cells.map((date) => {
          const { jm: cellMonth } = toJalali(date)
          const outside = cellMonth !== jm
          const summary = buildSummary(date, records[dayKey(date)], settings, now)
          return (
            <button
              key={date.toISOString()}
              className={[
                'day',
                outside ? 'is-outside' : '',
                summary.isWeekend ? 'is-weekend' : '',
                summary.isToday ? 'is-today' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelect(summary)}
              title={formatJalaliLong(date)}
            >
              <div className="day-head">
                <span className="day-num">{faDigits(summary.day)}</span>
                {summary.isToday && <span className="day-flag">امروز</span>}
              </div>
              {outside ? (
                <div className="day-empty-note">—</div>
              ) : (
                <CellBody d={summary} shift={{ start: settings.shiftStart, end: settings.shiftEnd }} />
              )}
            </button>
          )
        })}
      </div>

      <div className="day-list">
        {cells
          .filter((date) => toJalali(date).jm === jm && toJalali(date).jy === jy)
          .map((date) => {
            const summary = buildSummary(date, records[dayKey(date)], settings, now)
            return (
              <button
                key={date.toISOString()}
                className={[
                  'day-row',
                  summary.isToday ? 'is-today' : '',
                  summary.isWeekend ? 'is-weekend' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onSelect(summary)}
              >
                <div className="dcol">
                  <span className="dnum">{faDigits(summary.day)}</span>
                  <span className="dwd">{PERSIAN_WEEKDAYS_SHORT[summary.weekday].replace('‌', '')}</span>
                </div>
                <div className="dbody">
                  {summary.punches.length === 0 && !summary.leaveMinutes ? (
                    <div className="drow-times">
                      <span className="chip chip-gray">{statusLabel(summary)}</span>
                      {!summary.isWeekend && !summary.isFuture && (
                        <span className="tiny muted">برای ثبت، لمس کنید</span>
                      )}
                    </div>
                  ) : (
                    <div className="drow-times">
                      {summary.firstIn && (
                        <span className="c-teal num">ورود {timeFa(summary.firstIn)}</span>
                      )}
                      {summary.lastOut && (
                        <span className="c-red num">خروج {timeFa(summary.lastOut)}</span>
                      )}
                      {summary.leaveMinutes > 0 && (
                        <span className="chip chip-blue">مرخصی {formatDuration(summary.leaveMinutes)}</span>
                      )}
                      {summary.status === 'open' && <span className="chip chip-orange">در حال کار</span>}
                    </div>
                  )}
                  <div className="drow-times">
                    {summary.workedMinutes > 0 && (
                      <span className="chip chip-green num">کارکرد {formatDuration(summary.workedMinutes)}</span>
                    )}
                    {summary.approvedOvertimeMinutes > 0 && (
                      <span className="chip chip-violet num">
                        اضافه‌کاری {formatDuration(summary.approvedOvertimeMinutes)}
                      </span>
                    )}
                    {summary.lateMinutes > 0 && (
                      <span className="chip chip-red num">تاخیر {faDigits(summary.lateMinutes)}′</span>
                    )}
                    {summary.meetingMinutes > 0 && (
                      <span className="chip chip-orange num">جلسه {formatDuration(summary.meetingMinutes)}</span>
                    )}
                    {summary.missingOut && <span className="chip chip-red">خروج ثبت نشده</span>}
                    {summary.note && <span className="chip chip-gray">{summary.note}</span>}
                  </div>
                </div>
              </button>
            )
          })}
      </div>
    </section>
  )
}
