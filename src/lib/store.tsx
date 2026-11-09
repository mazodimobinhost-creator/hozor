import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { DayRecord, Punch, PunchType, Settings } from './types'
import { dayKey, fromJalali, minutesToTime, parseDayKey, persianWeekday, toJalali } from './jalali'

const STORAGE_KEY = 'hozor.v1'

export const defaultSettings: Settings = {
  fullName: 'محمدسجاد عضدی',
  jobTitle: 'کارشناس حضور و غیاب',
  unit: 'واحد پرسنلی و دبیرخانه',
  org: 'مجتمع فولاد',
  shiftStart: '08:00',
  shiftEnd: '17:00',
  breakMinutes: 0,
  weekendDays: [6],
  monthlyLeaveMinutes: 0,
}

type Records = Record<string, DayRecord>

export interface DayRange {
  in?: string
  out?: string
}

export interface DayInput {
  ranges: DayRange[]
  leaveMinutes?: number
  note?: string
  approvedOvertimeMinutes?: number
}

interface Persisted {
  settings: Settings
  records: Records
  seeded: boolean
}

interface StoreValue {
  settings: Settings
  records: Records
  updateSettings: (patch: Partial<Settings>) => void
  punch: (type: PunchType, at?: Date) => void
  removeLastPunch: () => void
  saveDay: (dateISO: string, data: DayInput) => void
  deleteDay: (dateISO: string) => void
  resetDemo: () => void
  clearAll: () => void
  todayPunches: Punch[]
}

const StoreContext = createContext<StoreValue | null>(null)

function timeOn(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(date)
  d.setHours(h, m, 0, 0)
  return d
}

export function SeedDemoData(now = new Date()): { settings: Settings; records: Records } {
  const records: Records = {}
  const { jy, jm } = toJalali(now)
  const settings = { ...defaultSettings }

  const months = [
    { jy, jm, upToToday: true },
    ...(() => {
      const prevM = jm === 1 ? 12 : jm - 1
      const prevY = jm === 1 ? jy - 1 : jy
      return [{ jy: prevY, jm: prevM, upToToday: false }]
    })(),
  ]

  for (const { jy: y, jm: m, upToToday } of months) {
    const days = 30
    for (let d = 1; d <= days; d++) {
      const date = fromJalali(y, m, d)
      const wd = persianWeekday(date)
      const isWeekend = settings.weekendDays.includes(wd)
      const key = dayKey(date)
      if (date > now) continue
      // deterministic pseudo random
      const rnd = (seed: number) => {
        const x = Math.sin(y * 97 + m * 31 + d * 7 + seed * 13) * 10000
        return x - Math.floor(x)
      }
      if (isWeekend) {
        if (rnd(1) > 0.82) {
          records[key] = {
            date: key,
            punches: [
              { type: 'in', at: timeOn(date, '09:40').toISOString(), source: 'manual' },
              { type: 'out', at: timeOn(date, '13:10').toISOString(), source: 'manual' },
            ],
            approvedOvertimeMinutes: 210,
          }
        }
        continue
      }
      const roll = rnd(2)
      if (roll < 0.05) continue // غیبت / ثبت نشده
      if (roll < 0.09) {
        records[key] = { date: key, punches: [], leaveMinutes: 540, note: 'مرخصی استحقاقی' }
        continue
      }
      if (roll < 0.13) {
        records[key] = { date: key, punches: [], leaveMinutes: 240, note: 'مرخصی ساعتی' }
        continue
      }
      if (upToToday && key === dayKey(now)) {
        // today: one open punch in the morning
        records[key] = {
          date: key,
          punches: [{ type: 'in', at: timeOn(date, '08:07').toISOString(), source: 'mobile' }],
        }
        continue
      }
      const inMin = 7 * 60 + 42 + Math.floor(rnd(3) * 78) // 07:42 - 09:00
      const baseOut = 17 * 60 + Math.floor(rnd(4) * 22) // 17:00 - 17:22
      const longDay = rnd(5) > 0.8
      const outMin = longDay ? baseOut + 90 + Math.floor(rnd(6) * 150) : baseOut
      const otApproved = rnd(7) > 0.55
      const meeting = rnd(8) > 0.8 ? 30 + Math.floor(rnd(9) * 3) * 30 : 0
      records[key] = {
        date: key,
        punches: [
          { type: 'in', at: timeOn(date, minutesToTime(inMin)).toISOString(), source: 'mobile' },
          { type: 'out', at: timeOn(date, minutesToTime(outMin)).toISOString(), source: 'mobile' },
        ],
        approvedOvertimeMinutes: otApproved ? Math.max(0, outMin - 17 * 60) : 0,
        meetingMinutes: meeting,
        note: meeting ? 'کسر کار جلسه' : undefined,
      }
    }
  }
  return { settings, records }
}

function loadState(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Persisted
      if (parsed && parsed.records && parsed.settings) {
        return { ...parsed, settings: { ...defaultSettings, ...parsed.settings } }
      }
    }
  } catch {
    /* ignore */
  }
  const seeded = SeedDemoData()
  return { settings: seeded.settings, records: seeded.records, seeded: true }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(() => loadState())
  const saveTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch {
        /* ignore quota */
      }
    }, 120)
    return () => window.clearTimeout(saveTimer.current)
  }, [state])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
  }, [])

  const punch = useCallback((type: PunchType, at: Date = new Date()) => {
    setState((s) => {
      const key = dayKey(at)
      const existing = s.records[key] ?? { date: key, punches: [] }
      const last = existing.punches[existing.punches.length - 1]
      // avoid double taps of the same type within 60s
      if (last && last.type === type && Math.abs(new Date(last.at).getTime() - at.getTime()) < 60_000) {
        return s
      }
      return {
        ...s,
        records: {
          ...s.records,
          [key]: {
            ...existing,
            punches: [...existing.punches, { type, at: at.toISOString(), source: 'mobile' }],
          },
        },
      }
    })
  }, [])

  const removeLastPunch = useCallback(() => {
    setState((s) => {
      const key = dayKey(new Date())
      const rec = s.records[key]
      if (!rec || rec.punches.length === 0) return s
      const punches = rec.punches.slice(0, -1)
      const records = { ...s.records }
      if (punches.length === 0 && !rec.leaveMinutes) delete records[key]
      else records[key] = { ...rec, punches }
      return { ...s, records }
    })
  }, [])

  const saveDay = useCallback((dateISO: string, data: DayInput) => {
    setState((s) => {
      const date = parseDayKey(dateISO)
      const punches: Punch[] = []
      for (const range of data.ranges) {
        if (range.in) punches.push({ type: 'in', at: timeOn(date, range.in).toISOString(), source: 'manual' })
        if (range.out) punches.push({ type: 'out', at: timeOn(date, range.out).toISOString(), source: 'manual' })
      }
      punches.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

      const records = { ...s.records }
      const isEmpty =
        punches.length === 0 && !data.leaveMinutes && !data.note && !data.approvedOvertimeMinutes
      if (isEmpty) {
        delete records[dateISO]
      } else {
        records[dateISO] = {
          date: dateISO,
          punches,
          leaveMinutes: data.leaveMinutes || undefined,
          note: data.note?.trim() || undefined,
          approvedOvertimeMinutes: data.approvedOvertimeMinutes || undefined,
        }
      }
      return { ...s, records }
    })
  }, [])

  const deleteDay = useCallback((dateISO: string) => {
    setState((s) => {
      const records = { ...s.records }
      delete records[dateISO]
      return { ...s, records }
    })
  }, [])

  const resetDemo = useCallback(() => {
    const seeded = SeedDemoData()
    setState({ settings: seeded.settings, records: seeded.records, seeded: true })
  }, [])

  const clearAll = useCallback(() => {
    setState((s) => ({ ...s, records: {}, seeded: false }))
  }, [])

  const todayPunches = useMemo(() => state.records[dayKey(new Date())]?.punches ?? [], [state.records])

  const value = useMemo<StoreValue>(
    () => ({
      settings: state.settings,
      records: state.records,
      updateSettings,
      punch,
      removeLastPunch,
      saveDay,
      deleteDay,
      resetDemo,
      clearAll,
      todayPunches,
    }),
    [
      state.settings,
      state.records,
      updateSettings,
      punch,
      removeLastPunch,
      saveDay,
      deleteDay,
      resetDemo,
      clearAll,
      todayPunches,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
