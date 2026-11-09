import type { DayRange, DayRecord, DaySummary, Punch, PunchType, Settings } from './types'
import {
  addDays,
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

/**
 * Shift window in "minutes from the attendance day's 00:00".
 * A shift like 08:00 -> 04:00 crosses midnight, so its end becomes 28:00 (1680).
 */
export function shiftWindow(settings: Settings) {
  const start = timeToMinutes(settings.shiftStart)
  const endRaw = timeToMinutes(settings.shiftEnd)
  const overnight = endRaw <= start
  const end = overnight ? endRaw + 1440 : endRaw
  const required = Math.max(0, end - start - (settings.breakMinutes || 0))
  return { start, end, endRaw, overnight, required }
}

/**
 * Turn editable in/out ranges of one attendance day into real punches.
 * A range whose out-time is earlier than its in-time is treated as "until dawn
 * of the next day" and is stored on the next calendar date, but still counted
 * for the attendance day it belongs to.
 */
export function buildPunches(dateISO: string, ranges: DayRange[], settings: Settings): Punch[] {
  const { start, endRaw, overnight } = shiftWindow(settings)
  const base = parseDayKey(dateISO)
  const isTail = (mins: number) => overnight && mins <= endRaw && mins < start

  const punches: Punch[] = []
  for (const range of ranges) {
    if (!range.in || !range.out) continue
    const inMins = timeToMinutes(range.in)
    const outMins = timeToMinutes(range.out)
    const inAbs = inMins + (isTail(inMins) ? 1440 : 0)
    let outAbs = outMins + (isTail(outMins) ? 1440 : 0)
    if (outAbs <= inAbs) outAbs += 1440

    const inDate = new Date(base)
    inDate.setHours(0, inAbs, 0, 0)
    const outDate = new Date(base)
    outDate.setHours(0, outAbs, 0, 0)
    punches.push({ type: 'in', at: inDate.toISOString(), source: 'manual' })
    punches.push({ type: 'out', at: outDate.toISOString(), source: 'manual' })
  }
  return punches.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
}

/** build a single punch for a given attendance day and clock time */
export function buildPunch(dateISO: string, type: PunchType, time: string, settings: Settings): Punch {
  const { start, endRaw, overnight } = shiftWindow(settings)
  const base = parseDayKey(dateISO)
  const [hh, mm] = time.split(':').map(Number)
  const mins = (hh || 0) * 60 + (mm || 0)
  const isTail = overnight && mins <= endRaw && mins < start
  const when = new Date(base)
  when.setHours(0, mins + (isTail ? 1440 : 0), 0, 0)
  return { type, at: when.toISOString(), source: 'manual' }
}

/** minutes since the attendance day's 00:00 (after-midnight punches get +1440) */
export function relMinutes(at: Date, key: string): number {
  const dayDiff = Math.round(
    (parseDayKey(dayKey(at)).getTime() - parseDayKey(key).getTime()) / 86_400_000,
  )
  return minutesOfDay(at) + dayDiff * 1440
}

/**
 * Which attendance day a punch belongs to.
 * Punches in the early-morning tail of an overnight shift (e.g. 02:00 when the
 * shift runs 08:00 -> 04:00) belong to the previous day.
 */
export function attendanceDayKey(at: Date, settings: Settings): string {
  const { start, endRaw, overnight } = shiftWindow(settings)
  const mins = minutesOfDay(at)
  if (overnight && mins <= endRaw) return dayKey(addDays(at, -1))
  if (!overnight && mins < start && mins <= endRaw) {
    // before the shift started: could be the tail of yesterday's overtime
    return dayKey(at)
  }
  return dayKey(at)
}

/** split punches into worked periods (in -> out) */
export function toPeriods(
  punches: Punch[],
  now: Date,
  dayKeyStr: string,
  fallbackEnd?: number,
): Period[] {
  const sorted = [...punches].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  const periods: Period[] = []
  let openAt: number | null = null
  for (const p of sorted) {
    const mins = relMinutes(new Date(p.at), dayKeyStr)
    if (p.type === 'in') {
      openAt = mins
    } else if (openAt !== null) {
      periods.push({ start: openAt, end: Math.max(mins, openAt) })
      openAt = null
    }
  }
  if (openAt !== null) {
    const today = dayKey(now)
    if (dayKeyStr < today) {
      // past day: never assume someone worked until midnight.
      const cap = fallbackEnd ?? 1440
      periods.push({ start: openAt, end: Math.max(Math.min(cap, 1440 + 1440), openAt) })
    } else {
      const nowMins = relMinutes(now, dayKeyStr)
      periods.push({ start: openAt, end: Math.max(nowMins, openAt) })
    }
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
  const isHoliday = isWeekend || Boolean(record?.holiday)
  const isToday = key === dayKey(now)
  const isFuture = key > dayKey(now)
  const punches = record?.punches ?? []
  const { start: shiftStart, end: shiftEnd, overnight, required } = shiftWindow(settings)

  const periods = toPeriods(punches, now, key, shiftEnd)
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
  if (firstIn && !isHoliday && leaveMinutes < required) {
    const firstInMins = relMinutes(new Date(firstIn.at), key)
    lateMinutes = Math.max(0, firstInMins - shiftStart)
  }

  let earlyLeaveMinutes = 0
  if (lastOut && !isOpen && !isHoliday && leaveMinutes < required) {
    const lastOutMins = relMinutes(new Date(lastOut.at), key)
    earlyLeaveMinutes = Math.max(0, shiftEnd - lastOutMins)
  }

  const effectiveWork = workedMinutes + Math.min(leaveMinutes, required) + meetingMinutes
  const overtimeMinutes = isHoliday ? workedMinutes : Math.max(0, effectiveWork - required)
  const pendingOvertimeMinutes = Math.max(0, overtimeMinutes - approvedOvertimeMinutes)
  // until the shift is over, a running day is not "deficit"
  const shiftIsOver = !isToday || relMinutes(now, key) >= shiftEnd
  const deficitMinutes =
    isFuture || isHoliday || !shiftIsOver ? 0 : Math.max(0, required - effectiveWork)

  let status: DaySummary['status'] = 'empty'
  if (isHoliday && workedMinutes > 0) status = 'holiday-work'
  else if (isHoliday) status = 'off'
  else if (leaveMinutes >= required) status = 'leave'
  else if (isOpen) status = 'open'
  else if (punches.length > 0) status = 'closed'
  else status = 'empty'

  return {
    key,
    missingOut: isOpen && key < dayKey(now),
    note: record?.note,
    day: jd,
    weekday,
    isWeekend,
    overnight,
    isHoliday,
    holiday: record?.holiday || undefined,
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
  const workdays = days.filter((d) => !d.isHoliday).length
  return {
    workMinutes: sum((d) => d.inShiftMinutes),
    inShiftMinutes: sum((d) => d.inShiftMinutes),
    outOfShiftMinutes: sum((d) => d.outOfShiftMinutes),
    approvedOvertime: sum((d) => d.approvedOvertimeMinutes),
    pendingOvertime: sum((d) => d.pendingOvertimeMinutes),
    meetingMinutes: sum((d) => d.meetingMinutes),
    holidayWork: sum((d) => (d.isHoliday ? d.workedMinutes : 0)),
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
