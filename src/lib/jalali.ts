import { toJalaali, toGregorian, jalaaliMonthLength, isLeapJalaaliYear } from 'jalaali-js'

export const PERSIAN_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
]

export const PERSIAN_WEEKDAYS_SHORT = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه']
export const PERSIAN_WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']

export interface JDate {
  jy: number
  jm: number
  jd: number
}

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']

export function faDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)])
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** local ISO day key, e.g. 2026-11-09 */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

export function toJalali(date: Date): JDate {
  return toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

export function fromJalali(jy: number, jm: number, jd: number): Date {
  const g = toGregorian(jy, jm, jd)
  return new Date(g.gy, g.gm - 1, g.gd, 0, 0, 0, 0)
}

export function monthLength(jy: number, jm: number): number {
  return jalaaliMonthLength(jy, jm)
}

export function jalaliYearIsLeap(jy: number): boolean {
  return isLeapJalaaliYear(jy)
}

/** 0 = شنبه ... 6 = جمعه */
export function persianWeekday(date: Date): number {
  return (date.getDay() + 1) % 7
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function startOfMonthGrid(jy: number, jm: number): Date {
  const first = fromJalali(jy, jm, 1)
  return addDays(first, -persianWeekday(first))
}

export function monthGrid(jy: number, jm: number): Date[] {
  const first = fromJalali(jy, jm, 1)
  const lead = persianWeekday(first)
  const days = monthLength(jy, jm)
  const cells = Math.ceil((lead + days) / 7) * 7
  const start = addDays(first, -lead)
  return Array.from({ length: cells }, (_, i) => addDays(start, i))
}

export function shiftMonth(jy: number, jm: number, delta: number): { jy: number; jm: number } {
  let m = jm + delta
  let y = jy
  while (m > 12) {
    m -= 12
    y += 1
  }
  while (m < 1) {
    m += 12
    y -= 1
  }
  return { jy: y, jm: m }
}

export function formatJalaliLong(date: Date): string {
  const { jy, jm, jd } = toJalali(date)
  return `${faDigits(jd)} ${PERSIAN_MONTHS[jm - 1]} ${faDigits(jy)}`
}

export function formatJalaliShort(date: Date): string {
  const { jy, jm, jd } = toJalali(date)
  return faDigits(`${jy}/${pad2(jm)}/${pad2(jd)}`)
}

export function formatClock(date: Date, withSeconds = false): string {
  const hh = pad2(date.getHours())
  const mm = pad2(date.getMinutes())
  const ss = pad2(date.getSeconds())
  return faDigits(withSeconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`)
}

/** "HH:MM" -> minutes since midnight */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function minutesToTime(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`
}

/** minutes -> "H:MM" (no zero padded hours), Persian digits */
export function formatDuration(minutes: number, persian = true): string {
  const total = Math.max(0, Math.round(Math.abs(minutes)))
  const h = Math.floor(total / 60)
  const m = total % 60
  const text = `${h}:${pad2(m)}`
  return persian ? faDigits(text) : text
}

export function formatSignedDuration(minutes: number): string {
  const sign = minutes < 0 ? '−' : ''
  return sign + formatDuration(minutes)
}

export function dateTimeToISO(date: Date): string {
  return date.toISOString()
}

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}
