import type { DayRecord, Settings } from './types'
import { buildPunch, buildPunches } from './calc'
import { dayKey, fromJalali, monthLength, toJalali } from './jalali'

/** ردیف‌های یک شیت به‌صورت متن */
export interface SheetData {
  name: string
  rows: string[][]
}

export const NO_COLUMN = -1

export interface ColumnMapping {
  headerRow: number
  date: number
  in: number
  out: number
  in2: number
  out2: number
  worked: number
  leave: number
  overtime: number
  note: number
}

export type ColumnKey = keyof Omit<ColumnMapping, 'headerRow'>

export interface ParsedRow {
  raw: string[]
  day: string | null
  in?: string
  out?: string
  in2?: string
  out2?: string
  note?: string
  leaveMinutes?: number
  overtimeMinutes?: number
  workedMinutes?: number
  holiday?: boolean
  ok: boolean
  error?: string
}

const FA_DIGITS = /[۰-۹]/g
const AR_DIGITS = /[٠-٩]/g

/** ارقام فارسی/عربی را به لاتین تبدیل می‌کند */
export function normalizeDigits(input: string): string {
  return input
    .replace(FA_DIGITS, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(AR_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[٫]/g, '.')
    .replace(/[,،]/g, '')
}

/** نرمال‌سازی متن سرستون‌ها: بدون نیم‌فاصله، بدون فاصله اضافی، حروف کوچک */
export function normalizeHeader(input: string): string {
  return normalizeDigits(String(input ?? ''))
    .replace(/[\u200c\u200f\u200e]/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

const clean = (value: string) => normalizeDigits(String(value ?? '')).replace(/\s+/g, ' ').trim()

/** شماره سریال اکسل → تاریخ میلادی */
function fromExcelSerial(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 80000) return null
  const ms = Math.round((serial - 25569) * 86_400_000)
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return null
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

/**
 * هر شکلی از تاریخ را به کلید روز میلادی (YYYY-MM-DD) تبدیل می‌کند:
 * ۱۴۰۴/۰۸/۱۸ · 1404-8-18 · 2025/11/09 · 2025-11-09T00:00:00 · 45234 (سریال اکسل)
 */
export function parseDateCell(input: string): string | null {
  const text = clean(input)
  if (!text) return null
  if (/^(—|-|–|\/|\?)$/.test(text)) return null

  // سریال اکسل
  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = Number(text)
    if (serial > 20000) {
      const date = fromExcelSerial(serial)
      return date ? dayKey(date) : null
    }
    if (/^\d{8}$/.test(text)) {
      // 14040818 یا 20251109
      const y = Number(text.slice(0, 4))
      const m = Number(text.slice(4, 6))
      const d = Number(text.slice(6, 8))
      return buildDay(y, m, d)
    }
    return null
  }

  const match = text.match(/^(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})/)
  if (match) {
    const a = Number(match[1])
    const b = Number(match[2])
    const c = Number(match[3])
    // ۱۸/۰۸/۱۴۰۴ → روز/ماه/سال
    if (a <= 31 && (c > 31 || c >= 1000)) return buildDay(expandYear(c), b, a)
    // ۱۴۰۴/۰۸/۱۸ یا 2025-11-09 → سال/ماه/روز
    return buildDay(expandYear(a), b, c)
  }

  // ۱۸ آبان ۱۴۰۴
  const named = text.match(/^(\d{1,2})\s+([^\d]+)\s+(\d{2,4})$/)
  if (named) {
    const day = Number(named[1])
    const month = PERSIAN_MONTH_INDEX[normalizeHeader(named[2])]
    let year = Number(named[3])
    if (year < 100) year = 1400 + year
    if (month) return buildDay(year, month, day)
  }

  // تلاش نهایی با Date
  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime()) && parsed.getFullYear() > 1900) {
    return dayKey(parsed)
  }
  return null
}

const PERSIAN_MONTH_INDEX: Record<string, number> = {
  فروردین: 1,
  اردیبهشت: 2,
  خرداد: 3,
  تیر: 4,
  مرداد: 5,
  شهریور: 6,
  مهر: 7,
  آبان: 8,
  آذر: 9,
  دی: 10,
  بهمن: 11,
  اسفند: 12,
}

function expandYear(value: number): number {
  if (value >= 1000) return value
  // سال دو رقمی: در این اپ شمسی فرض می‌شود (۰۴ → ۱۴۰۴)
  return 1400 + value
}

function buildDay(year: number, month: number, day: number): string | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  if (year >= 1200 && year <= 1600) {
    if (month < 1 || month > 12 || day < 1) return null
    if (day > monthLength(year, month)) return null
    try {
      const date = fromJalali(year, month, day)
      const back = toJalali(date)
      if (back.jy !== year || back.jm !== month || back.jd !== day) return null
      return dayKey(date)
    } catch {
      return null
    }
  }
  if (year >= 1900 && year <= 2100) {
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    const date = new Date(year, month - 1, day)
    if (date.getMonth() !== month - 1 || date.getDate() !== day) return null
    return dayKey(date)
  }
  return null
}

/** ساعت را به HH:MM تبدیل می‌کند (کسر روز اکسل، ۸:۵، 08:05:00 ...) */
export function parseTimeCell(input: string): string | null {
  const text = clean(input)
  if (!text) return null
  if (/^(—|-|–|\?)$/.test(text)) return null

  // کسر روز اکسل: 0.3368
  if (/^0?\.\d+$/.test(text)) {
    const fraction = Number(text)
    if (fraction > 0 && fraction < 1) {
      const minutes = Math.round(fraction * 1440)
      return fmtMinutes(minutes)
    }
    return null
  }

  const colon = text.match(/(\d{1,2})[:.](\d{1,2})(?:[:.](\d{1,2}))?/)
  if (colon) {
    const h = Number(colon[1])
    const m = Number(colon[2])
    if (h > 23 || m > 59) return null
    return fmtMinutes(h * 60 + m)
  }

  if (/^\d+$/.test(text)) {
    const value = Number(text)
    if (value >= 100) {
      // ۸۳۰ یا ۱۶۰۵
      const h = Math.floor(value / 100)
      const m = value % 100
      if (h <= 23 && m <= 59) return fmtMinutes(h * 60 + m)
      return null
    }
    if (value <= 23) return fmtMinutes(value * 60)
    if (value <= 1439) return fmtMinutes(value)
  }

  return null
}

function fmtMinutes(total: number): string {
  const mins = ((total % 1440) + 1440) % 1440
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** مدت (کارکرد/مرخصی/اضافه‌کاری) را به دقیقه تبدیل می‌کند: ۸:۳۰ · 8.5 · ۸ ساعت ۳۰ دقیقه · 510 */
export function parseDurationCell(input: string): number | null {
  const text = clean(input)
  if (!text) return null
  if (/^(—|-|–)$/.test(text)) return null

  const hourWord = text.match(/(\d+(?:\.\d+)?)\s*(?:ساعت|ساعته)/)
  const minWord = text.match(/(\d+)\s*(?:دقیقه|دقيقه)/)
  if (hourWord || minWord) {
    const h = hourWord ? Number(hourWord[1]) : 0
    const m = minWord ? Number(minWord[1]) : 0
    return Math.round(h * 60 + m)
  }

  const colon = text.match(/^(\d{1,2})[:.](\d{1,2})(?:[:.](\d{1,2}))?$/)
  if (colon) return Number(colon[1]) * 60 + Number(colon[2])

  if (/^\d+(\.\d+)?$/.test(text)) {
    const value = Number(text)
    if (value > 0 && value <= 24) return Math.round(value * 60)
    if (value > 24) return Math.round(value)
  }
  return null
}

const KEYWORDS = {
  date: ['تاریخ', 'تاريخ', 'date', 'روز', 'day'],
  in: ['ورود', 'ورود 1', 'ورود1', 'in', 'enter', 'checkin', 'check in', 'start', 'شروع'],
  out: ['خروج', 'خروج 1', 'خروج1', 'out', 'exit', 'checkout', 'check out', 'پایان', 'پایان کار'],
  in2: ['ورود 2', 'ورود2', 'ورود دوم', 'in2', 'in 2', 'second in'],
  out2: ['خروج 2', 'خروج2', 'خروج دوم', 'out2', 'out 2', 'second out'],
  worked: ['کارکرد', 'مدت', 'مجموع', 'جمع', 'ساعت کار', 'worked', 'total', 'duration', 'حضور'],
  leave: ['مرخصی', 'مرخصى', 'استحقاقی', 'استعلاجی', 'leave', 'vacation'],
  overtime: ['اضافه کار', 'اضافهكار', 'اضافه‌کاری', 'اضافه کاری', 'اضافهکار', 'overtime', 'extra'],
  note: ['توضیح', 'توضیحات', 'note', 'remark', 'شرح', 'ملاحظات', 'علت', 'وضعیت'],
  header: ['تاریخ', 'تاريخ', 'date', 'ورود', 'خروج', 'کارکرد', 'روز'],
}

const SECOND_MARK = /(۲|2|دوم|second|ii)/

function scoreHeader(row: string[]): number {
  let score = 0
  for (const cell of row) {
    const text = normalizeHeader(cell)
    if (!text) continue
    if (KEYWORDS.header.some((k) => text.includes(normalizeHeader(k)))) score++
  }
  return score
}

/** از میان سرستون‌ها، ستون متناظر با کلیدواژه‌ها را پیدا می‌کند */
function findColumn(headers: string[], keys: string[], options?: { second?: boolean }): number {
  const normalized = headers.map(normalizeHeader)
  const keyList = keys.map(normalizeHeader)
  const matches = (header: string) => keyList.some((k) => header === k || header.includes(k))
  const pool = normalized
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => Boolean(header) && matches(header))
    .filter(({ header }) =>
      options?.second === undefined ? true : options.second ? SECOND_MARK.test(header) : !SECOND_MARK.test(header),
    )
  if (!pool.length) return NO_COLUMN
  // تطابق کامل اولویت دارد
  const exact = pool.find(({ header }) => keyList.includes(header))
  return (exact ?? pool[0]).index
}

/** ردیف سرستون و ستون‌ها را حدس می‌زند */
export function guessMapping(rows: string[][]): ColumnMapping {
  let headerRow = 0
  let best = -1
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const score = scoreHeader(rows[i] ?? [])
    if (score > best) {
      best = score
      headerRow = i
    }
  }
  if (best < 2) headerRow = 0
  const headers = rows[headerRow] ?? []
  const mapping: ColumnMapping = {
    headerRow,
    date: findColumn(headers, KEYWORDS.date),
    in: findColumn(headers, [...KEYWORDS.in, ...KEYWORDS.in2], { second: false }),
    out: findColumn(headers, [...KEYWORDS.out, ...KEYWORDS.out2], { second: false }),
    in2: findColumn(headers, [...KEYWORDS.in, ...KEYWORDS.in2], { second: true }),
    out2: findColumn(headers, [...KEYWORDS.out, ...KEYWORDS.out2], { second: true }),
    worked: findColumn(headers, KEYWORDS.worked),
    leave: findColumn(headers, KEYWORDS.leave),
    overtime: findColumn(headers, KEYWORDS.overtime),
    note: findColumn(headers, KEYWORDS.note),
  }
  if (mapping.date === NO_COLUMN) mapping.date = 0
  return mapping
}

const yesWords = /(بله|آری|درست|yes|true|1|تعطیل|holiday)/

function parseHoliday(value: string): boolean {
  const text = normalizeHeader(value)
  if (!text) return false
  return yesWords.test(text) && !/^(0|false|no|خیر)$/.test(text)
}

export function buildRows(
  rows: string[][],
  mapping: ColumnMapping,
): { parsed: ParsedRow[]; invalid: number } {
  const parsed: ParsedRow[] = []
  let invalid = 0
  const cell = (cells: string[], index: number) => (index >= 0 ? cells[index] ?? '' : '')

  for (let i = mapping.headerRow + 1; i < rows.length; i++) {
    const row = rows[i] ?? []
    const cells = row.map((value) => clean(value))
    if (!cells.some(Boolean)) continue

    const day = parseDateCell(cell(cells, mapping.date))
    if (!day) {
      invalid++
      continue
    }

    let inTime = parseTimeCell(cell(cells, mapping.in))
    let outTime = parseTimeCell(cell(cells, mapping.out))
    let in2Time = parseTimeCell(cell(cells, mapping.in2))
    let out2Time = parseTimeCell(cell(cells, mapping.out2))
    const workedMinutes = parseDurationCell(cell(cells, mapping.worked))
    const leaveMinutes = parseDurationCell(cell(cells, mapping.leave))
    const overtimeMinutes = parseDurationCell(cell(cells, mapping.overtime))
    const noteText = cell(cells, mapping.note)
    const note = noteText && noteText !== '—' && noteText !== '-' ? noteText : undefined
    const holiday = parseHoliday(noteText)

    // اگر خروج ثبت نشده ولی مدت کارکرد داریم، خروج را حساب می‌کنیم
    if (!outTime && inTime && workedMinutes) {
      const [h, m] = inTime.split(':').map(Number)
      outTime = fmtMinutes(h * 60 + m + workedMinutes)
    }

    const ok = Boolean(
      inTime || outTime || in2Time || out2Time || workedMinutes || leaveMinutes || overtimeMinutes || note || holiday,
    )

    parsed.push({
      raw: row,
      day,
      in: inTime ?? undefined,
      out: outTime ?? undefined,
      in2: in2Time ?? undefined,
      out2: out2Time ?? undefined,
      note,
      leaveMinutes: leaveMinutes ?? undefined,
      overtimeMinutes: overtimeMinutes ?? undefined,
      workedMinutes: workedMinutes ?? undefined,
      holiday: holiday || undefined,
      ok,
      error: ok ? undefined : 'ساعت یا مقدار قابل ثبتی ندارد',
    })
    if (!ok) invalid++
  }
  return { parsed, invalid }
}

/** ردیف‌های پارس‌شده را به رکوردهای اپ تبدیل می‌کند */
export function rowsToDayRecords(rows: ParsedRow[], settings: Settings): DayRecord[] {
  const records: DayRecord[] = []
  for (const row of rows) {
    if (!row.day || !row.ok) continue

    const pairs: { in?: string; out?: string }[] = []
    if (row.in || row.out) pairs.push({ in: row.in, out: row.out })
    if (row.in2 || row.out2) pairs.push({ in: row.in2, out: row.out2 })

    // فقط مدت کارکرد داده شده: ساعت‌ها را از روی شیفت بازسازی می‌کنیم
    if (!pairs.length && row.workedMinutes) {
      const [h, m] = settings.shiftStart.split(':').map(Number)
      pairs.push({
        in: settings.shiftStart,
        out: fmtMinutes(h * 60 + m + row.workedMinutes),
      })
    }

    const complete = pairs.filter((pair) => pair.in && pair.out)
    let punches =
      complete.length > 0
        ? buildPunches(row.day, complete.map((pair) => ({ in: pair.in, out: pair.out })), settings)
        : []

    if (!punches.length) {
      const single = []
      for (const pair of pairs) {
        if (pair.in) single.push(buildPunch(row.day, 'in', pair.in, settings))
        else if (pair.out) single.push(buildPunch(row.day, 'out', pair.out, settings))
      }
      punches = single
    }

    const record: DayRecord = { date: row.day, punches }
    if (row.holiday) record.holiday = true
    if (row.leaveMinutes) record.leaveMinutes = row.leaveMinutes
    if (row.overtimeMinutes) record.approvedOvertimeMinutes = row.overtimeMinutes
    if (row.note) record.note = row.note

    const hasContent =
      punches.length > 0 || record.leaveMinutes || record.approvedOvertimeMinutes || record.note || record.holiday
    if (hasContent) records.push(record)
  }
  return records
}

/** فایل اکسل/CSV را به شیت‌های متنی تبدیل می‌کند */
export async function readWorkbook(data: ArrayBuffer): Promise<SheetData[]> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(new Uint8Array(data), { type: 'array', cellDates: true })
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name]
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    }) as unknown as string[][]
    return {
      name,
      rows: rows.map((row) => (row ?? []).map((value) => (value == null ? '' : String(value)))),
    }
  })
}

/** لینک‌های اشتراکی را به لینک دانلود مستقیم تبدیل می‌کند */
export function normalizeImportUrl(rawUrl: string): string {
  const url = rawUrl.trim()
  if (!url) return url

  // گوگل شیت
  const sheet = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (sheet) {
    const gid = url.match(/[#&?]gid=(\d+)/)
    const gidPart = gid ? `&gid=${gid[1]}` : ''
    return `https://docs.google.com/spreadsheets/d/${sheet[1]}/export?format=xlsx${gidPart}`
  }

  // فایل گوگل درایو
  const drive = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9-_]+)/)
  if (drive) return `https://drive.google.com/uc?export=download&id=${drive[1]}&confirm=t`

  // دراپ‌باکس
  if (/dropbox\.com/.test(url)) {
    if (/[?&]dl=0/.test(url)) return url.replace(/([?&])dl=0/, '$1dl=1')
    if (/[?&]dl=1/.test(url)) return url
    return url.includes('?') ? `${url}&dl=1` : `${url}?dl=1`
  }

  return url
}
