import type { DayRecord, DaySummary, Punch, Settings } from './types'
import {
  dayKey,
  formatDuration,
  minutesOfDay,
  parseDayKey,
  persianWeekday,
  timeToMinutes,
  toJalali,
  fromJalali,
  monthLength,
} from './jalali'

export interface Period {
  start: number
  end: number
}

/** split punches into worked periods (in -> out) */
export function toPeriods(punches: Punch[], now: Date, dayKeyStr: string): Period[] {
  const sorted = [...punches].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  const periods: Period[] = []
  let openAt: number | null = null
  for (const p of sorted) {
    const d = new Date(p.at)
    let mins = minutesOfDay(d)
    // punches after midnight belong to the next clock day: shift them by 1440? keep same-day logic
    if (dayKey(d) !== dayKeyStr) mins = minutesOfDay(d) + 1440
    if (p.type === 'in') {
      openAt = mins
    } else if (openAt !== null) {
      periods.push({ start: openAt, end: Math.max(mins, openAt) })
      openAt = null
    }
  }
  if (openAt !== null) {
    const nowMins =
      dayKey(now) === dayKeyStr ? minutesOfDay(now) : dayKey(now) > dayKeyStr ? 1440 + minutesOfDay(now) : 1440
    periods.push({ start: openAt, end: Math.max(nowMins, openAt) })
  }
  return periods
}

const overlap = (a: Period, b: Period) => Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start))

export function buildSummary(
  date: Date,
  record: DayRecord | undefined,
  settings: Settings,
  now = new Date(),
): DaySummary {
  const key = dayKey(date)
  const { jd } = toJalali(date)
  const weekday = persianWeekday(date)
  const isWeekend = settings.weekendDays.includes(weekday)
  const isToday = key === dayKey(now)
  const isFuture = key > dayKey(now)
  const punches = record?.punches ?? []
  const shiftStart = timeToMinutes(settings.shiftStart)
  const shiftEnd = timeToMinutes(settings.shiftEnd)
  const required = Math.max(0, shiftEnd - shiftStart)

  const periods = toPeriods(punches, now, key)
  const workedMinutes = periods.reduce((sum, p) => sum + (p.end - p.start), 0)
  const inShiftMinutes = periods.reduce((sum, p) => sum + overlap(p, { start: shiftStart, end: shiftEnd }), 0)
  const outOfShiftMinutes = Math.max(0, workedMinutes - inShiftMinutes)

  const entries = [...punches].filter((p) => p.type === 'in').sort(byTime)
  const exits = [...punches].filter((p) => p.type === 'out').sort(byTime)
  const firstIn = entries[0]
  const lastOut = exits[exits.length - 1]
  const isOpen = entries.length > exits.length

  const leaveMinutes = record?.leaveMinutes ?? 0
  const meetingMinutes = record?.meetingMinutes ?? 0
  const approvedOvertimeMinutes = record?.approvedOvertimeMinutes ?? 0

  let lateMinutes = 0
  if (firstIn && !isWeekend && leaveMinutes < required) {
    const firstInMins = minutesOfDay(new Date(firstIn.at))
    lateMinutes = Math.max(0, firstInMins - shiftStart)
  }

  let earlyLeaveMinutes = 0
  if (lastOut && !isOpen && !isWeekend && leaveMinutes < required) {
    const lastOutMins = minutesOfDay(new Date(lastOut.at))
    earlyLeaveMinutes = Math.max(0, shiftEnd - lastOutMins)
  }

  const effectiveWork = workedMinutes + Math.min(leaveMinutes, required) + meetingMinutes
  const overtimeMinutes = isWeekend ? workedMinutes : Math.max(0, effectiveWork - required)
  const pendingOvertimeMinutes = Math.max(0, overtimeMinutes - approvedOvertimeMinutes)
  const deficitMinutes = isFuture || isWeekend ? 0 : Math.max(0, required - effectiveWork)

  let status: DaySummary['status'] = 'empty'
  if (isWeekend && workedMinutes > 0) status = 'holiday-work'
  else if (isWeekend) status = 'off'
  else if (leaveMinutes >= required) status = 'leave'
  else if (isOpen) status = 'open'
  else if (punches.length > 0) status = 'closed'
  else status = 'empty'

  return {
    key,
    day: jd,
    weekday,
    isWeekend,
    isHoliday: isWeekend,
    isToday,
    isFuture,
    punches,
    firstIn: firstIn ? new Date(firstIn.at).toISOString() : undefined,
    lastOut: lastOut ? new Date(lastOut.at).toISOString() : undefined,
    workedMinutes,
    inShiftMinutes,
    outOfShiftMinutes,
    overtimeMinutes,
    approvedOvertimeMinutes: Math.min(approvedOvertimeMinutes, Math.max(overtimeMinutes, approvedOvertimeMinutes)),
    pendingOvertimeMinutes,
    lateMinutes,
    earlyLeaveMinutes,
    meetingMinutes,
    leaveMinutes,
    deficitMinutes,
    status,
  }
}

function byTime(a: Punch, b: Punch) {
  return new Date(a.at).getTime() - new Date(b.at).getTime()
}

export function monthDays(jy: number, jm: number): Date[] {
  return Array.from({ length: monthLength(jy, jm) }, (_, i) => fromJalali(jy, jm, i + 1))
}

export interface MonthStats {
  workMinutes: number
  inShiftMinutes: number
  outOfShiftMinutes: number
  approvedOvertime: number
  pendingOvertime: number
  meetingMinutes: number
  holidayWork: number
  lateMinutes: number
  leaveMinutes: number
  totalWorked: number
  deficitMinutes: number
  presentDays: number
  workdays: number
  days: DaySummary[]
}

export function computeMonth(
  jy: number,
  jm: number,
  records: Record<string, DayRecord>,
  settings: Settings,
  now = new Date(),
): MonthStats {
  const days = monthDays(jy, jm).map((d) => buildSummary(d, records[dayKey(d)], settings, now))
  const sum = (fn: (d: DaySummary) => number) => days.reduce((acc, d) => acc + fn(d), 0)
  const workdays = days.filter((d) => !d.isWeekend).length
  return {
    workMinutes: sum((d) => d.inShiftMinutes),
    inShiftMinutes: sum((d) => d.inShiftMinutes),
    outOfShiftMinutes: sum((d) => d.outOfShiftMinutes),
    approvedOvertime: sum((d) => d.approvedOvertimeMinutes),
    pendingOvertime: sum((d) => d.pendingOvertimeMinutes),
    meetingMinutes: sum((d) => d.meetingMinutes),
    holidayWork: sum((d) => (d.isWeekend ? d.workedMinutes : 0)),
    lateMinutes: sum((d) => d.lateMinutes),
    leaveMinutes: sum((d) => d.leaveMinutes),
    totalWorked: sum((d) => d.workedMinutes),
    deficitMinutes: sum((d) => d.deficitMinutes),
    presentDays: days.filter((d) => d.punches.length > 0 || d.leaveMinutes > 0).length,
    workdays,
    days,
  }
}

export const statusLabel = (d: DaySummary): string => {
  switch (d.status) {
    case 'off':
      return 'تعطیل'
    case 'leave':
      return 'مرخصی'
    case 'open':
      return 'در حال کار'
    case 'holiday-work':
      return 'کار در تعطیل'
    case 'closed':
      return 'پایان کار'
    default:
      return 'ثبت نشده'
  }
}

export const duration = formatDuration
