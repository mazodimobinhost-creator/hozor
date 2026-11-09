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
import type { DayRange, DayRecord, Punch, PunchType, Settings } from './types'
import { attendanceDayKey, buildPunch, buildPunches, shiftWindow } from './calc'
import {
  dayKey,
  fromJalali,
  minutesToTime,
  parseDayKey,
  persianWeekday,
  toJalali,
} from './jalali'
import { useAuth } from './auth'
import {
  fetchDayRecords,
  fetchProfile,
  profileRowToSettings,
  pushDayRecords,
  removeAllDayRecords,
  removeDayRecords,
  saveProfile,
  type DayRecordRow,
} from './remote'

const LEGACY_KEY = 'hozor.v1'
const cacheKey = (userId: string) => `hozor.cache.v2.${userId}`
const queueKey = (userId: string) => `hozor.queue.v2.${userId}`
const migratedKey = (userId: string) => `hozor.migrated.${userId}`

/** تنظیمات پیش‌فرض — عمداً خالی است تا هیچ‌کس اطلاعات فرد دیگری را به ارث نبرد */
export const defaultSettings: Settings = {
  fullName: '',
  jobTitle: '',
  unit: '',
  org: '',
  shiftStart: '08:00',
  shiftEnd: '04:00',
  breakMinutes: 0,
  weekendDays: [6],
  monthlyLeaveMinutes: 0,
}

export type { DayRange }

type Records = Record<string, DayRecord>

export interface DayInput {
  ranges: DayRange[]
  leaveMinutes?: number
  note?: string
  approvedOvertimeMinutes?: number
}

export type ImportMode = 'replace' | 'merge' | 'skip'

export type ServerState = 'idle' | 'syncing' | 'saved' | 'offline'

export interface LegacyInfo {
  recordCount: number
  fullName: string
}

interface Persisted {
  settings: Settings
  records: Records
}

interface Queue {
  upserts: DayRecord[]
  deletes: string[]
  settings?: Settings
}

interface StoreValue {
  settings: Settings
  records: Records
  /** در حال آوردن داده از سرور */
  loading: boolean
  serverState: ServerState
  userEmail: string
  updateSettings: (patch: Partial<Settings>) => void
  punch: (type: PunchType, at?: Date) => void
  /** record an entry/exit for a specific attendance day at a specific clock time */
  punchOn: (dateISO: string, type: PunchType, time: string) => void
  removeLastPunch: () => void
  saveDay: (dateISO: string, data: DayInput) => void
  deleteDay: (dateISO: string) => void
  importRecords: (incoming: DayRecord[], mode: ImportMode) => Promise<number>
  resetDemo: () => void
  clearAll: () => void
  refresh: () => Promise<void>
  todayPunches: Punch[]
  /** داده‌های نسخه قدیمی (بدون لاگین) که روی این دستگاه مانده است */
  legacy: LegacyInfo | null
  migrateLegacy: () => Promise<number>
  dismissLegacy: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota */
  }
}

export function SeedDemoData(now = new Date()): { settings: Settings; records: Records } {
  const records: Records = {}
  const { jy, jm } = toJalali(now)
  const settings = { ...defaultSettings }
  const { start, endRaw } = shiftWindow(settings)

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
          const punches = buildPunches(key, [{ in: '09:30', out: '13:00' }], settings)
          records[key] = { date: key, punches, approvedOvertimeMinutes: 210 }
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
        // امروز فقط ورود ثبت شده است
        const at = new Date(date)
        at.setHours(0, start + 7, 0, 0)
        records[key] = { date: key, punches: [{ type: 'in', at: at.toISOString(), source: 'mobile' }] }
        continue
      }

      const inMins = start - 18 + Math.floor(rnd(3) * 40)
      const longDay = rnd(5) > 0.8
      const outMins =
        endRaw - 8 + Math.floor(rnd(4) * 24) + (longDay ? 90 + Math.floor(rnd(6) * 150) : 0)
      const meeting = rnd(8) > 0.82 ? 30 + Math.floor(rnd(9) * 3) * 30 : 0
      const overt = Math.max(0, outMins - endRaw)
      const punches = buildPunches(
        key,
        [{ in: minutesToTime(inMins), out: minutesToTime(outMins % 1440) }],
        settings,
      )
      records[key] = {
        date: key,
        punches,
        approvedOvertimeMinutes: rnd(7) > 0.55 ? overt : 0,
        meetingMinutes: meeting,
        note: meeting ? 'کسر کار جلسه' : undefined,
      }
    }
  }
  return { settings, records }
}

function rowsToRecords(rows: DayRecordRow[]): Records {
  const records: Records = {}
  for (const row of rows) {
    records[row.day] = {
      date: row.day,
      punches: Array.isArray(row.punches) ? row.punches : [],
      leaveMinutes: row.leave_minutes ?? undefined,
      meetingMinutes: row.meeting_minutes ?? undefined,
      approvedOvertimeMinutes: row.approved_overtime_minutes ?? undefined,
      note: row.note ?? undefined,
    }
  }
  return records
}

function recordToRow(record: DayRecord) {
  return {
    day: record.date,
    punches: record.punches ?? [],
    leave_minutes: record.leaveMinutes ?? null,
    meeting_minutes: record.meetingMinutes ?? null,
    approved_overtime_minutes: record.approvedOvertimeMinutes ?? null,
    note: record.note ?? null,
  }
}

function readQueue(userId: string): Queue {
  const queue = readJSON<Queue>(queueKey(userId))
  if (!queue || !Array.isArray(queue.upserts) || !Array.isArray(queue.deletes)) {
    return { upserts: [], deletes: [] }
  }
  return queue
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user?.id ?? ''
  const userEmail = session?.user?.email ?? ''

  const [state, setState] = useState<Persisted>(() => ({
    settings: defaultSettings,
    records: {},
  }))
  const [loading, setLoading] = useState(true)
  const [serverState, setServerState] = useState<ServerState>('idle')
  const [legacy, setLegacy] = useState<LegacyInfo | null>(null)

  const stateRef = useRef(state)
  stateRef.current = state
  const saveTimer = useRef<number | undefined>(undefined)
  const profileTimer = useRef<number | undefined>(undefined)

  const apply = useCallback((next: Persisted) => {
    stateRef.current = next
    setState(next)
  }, [])

  /** تغییرات را روی سرور می‌نویسد و در صورت خطا در صف آفلاین نگه می‌دارد */
  const pushChanges = useCallback(
    async (upserts: DayRecord[], deletes: string[]) => {
      if (!userId || (!upserts.length && !deletes.length)) return
      try {
        await pushDayRecords(userId, upserts.map(recordToRow))
        await removeDayRecords(
          userId,
          deletes.filter((day) => !upserts.some((record) => record.date === day)),
        )
        setServerState('saved')
      } catch {
        const queue = readQueue(userId)
        const map = new Map(queue.upserts.map((record) => [record.date, record]))
        for (const record of upserts) map.set(record.date, record)
        const deleted = new Set([...queue.deletes, ...deletes])
        for (const record of upserts) deleted.delete(record.date)
        writeJSON(queueKey(userId), {
          upserts: [...map.values()],
          deletes: [...deleted],
          settings: queue.settings,
        })
        setServerState('offline')
      }
    },
    [userId],
  )

  const drainQueue = useCallback(async () => {
    if (!userId) return
    const queue = readQueue(userId)
    if (!queue.upserts.length && !queue.deletes.length && !queue.settings) return
    const upsertedDays = new Set(queue.upserts.map((record) => record.date))
    try {
      if (queue.upserts.length) await pushDayRecords(userId, queue.upserts.map(recordToRow))
      const deletes = queue.deletes.filter((day) => !upsertedDays.has(day))
      if (deletes.length) await removeDayRecords(userId, deletes)
      if (queue.settings) await saveProfile(userId, queue.settings)
      writeJSON(queueKey(userId), { upserts: [], deletes: [] })
      setServerState('saved')
    } catch {
      setServerState('offline')
    }
  }, [userId])

  const queueSettings = useCallback(
    (settings: Settings) => {
      if (!userId) return
      const queue = readQueue(userId)
      writeJSON(queueKey(userId), { ...queue, settings })
    },
    [userId],
  )

  // بارگذاری اولیه: کش محلی، سپس داده سرور
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setLoading(true)
    setServerState('syncing')

    const cached = readJSON<Persisted>(cacheKey(userId))
    if (cached?.settings && cached?.records) {
      apply({ settings: { ...defaultSettings, ...cached.settings }, records: cached.records })
      setLoading(false)
    } else {
      apply({ settings: defaultSettings, records: {} })
    }

    void (async () => {
      try {
        const [profile, rows] = await Promise.all([fetchProfile(userId), fetchDayRecords(userId)])
        if (cancelled) return
        const records = rowsToRecords(rows)
        const base = cached?.settings ?? defaultSettings
        const settings = profileRowToSettings(profile, { ...defaultSettings, ...base })
        // اگر پروفایل هنوز نامی ندارد ولی ثبت‌نام نام داشته، آن را بنویس
        const metaName = (session?.user?.user_metadata?.full_name as string | undefined) ?? ''
        const merged: Settings = {
          ...settings,
          fullName: settings.fullName || metaName,
        }
        apply({ settings: merged, records })
        writeJSON(cacheKey(userId), { settings: merged, records })
        setServerState('saved')
        await drainQueue()
      } catch {
        if (!cancelled) setServerState('offline')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    // داده‌های نسخه قدیمی (قبل از لاگین)
    const legacyRaw = readJSON<{ settings?: Settings; records?: Records; seeded?: boolean }>(
      LEGACY_KEY,
    )
    if (legacyRaw?.records && !localStorage.getItem(migratedKey(userId))) {
      const recordCount = Object.values(legacyRaw.records).filter(
        (record) => record && ((record.punches?.length ?? 0) > 0 || record.leaveMinutes),
      ).length
      if (recordCount > 0) {
        setLegacy({
          recordCount,
          fullName: legacyRaw.settings?.fullName ?? '',
        })
      }
    }

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // کش محلی با تاخیر کوتاه
  useEffect(() => {
    if (!userId) return
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      writeJSON(cacheKey(userId), state)
    }, 150)
    return () => window.clearTimeout(saveTimer.current)
  }, [state, userId])

  // هر بار آنلاین شدیم، صف را خالی کن
  useEffect(() => {
    const handler = () => {
      void drainQueue()
    }
    window.addEventListener('online', handler)
    return () => window.removeEventListener('online', handler)
  }, [drainQueue])

  const commit = useCallback(
    (records: Records, changed: string[], removed: string[]) => {
      apply({ ...stateRef.current, records })
      void pushChanges(
        changed.map((key) => records[key]).filter(Boolean),
        removed,
      )
    },
    [apply, pushChanges],
  )

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      const next: Persisted = { ...stateRef.current, settings: { ...stateRef.current.settings, ...patch } }
      apply(next)
      if (!userId) return
      window.clearTimeout(profileTimer.current)
      profileTimer.current = window.setTimeout(() => {
        setServerState('syncing')
        void saveProfile(userId, next.settings)
          .then(() => setServerState('saved'))
          .catch(() => {
            queueSettings(next.settings)
            setServerState('offline')
          })
      }, 500)
    },
    [apply, queueSettings, userId],
  )

  const punch = useCallback(
    (type: PunchType, at: Date = new Date()) => {
      const current = stateRef.current
      const key = attendanceDayKey(at, current.settings)
      const existing = current.records[key] ?? { date: key, punches: [] }
      const last = existing.punches[existing.punches.length - 1]
      // avoid double taps of the same type within 60s
      if (last && last.type === type && Math.abs(new Date(last.at).getTime() - at.getTime()) < 60_000) {
        return
      }
      const next = {
        ...current.records,
        [key]: {
          ...existing,
          punches: [...existing.punches, { type, at: at.toISOString(), source: 'mobile' as const }],
        },
      }
      commit(next, [key], [])
    },
    [commit],
  )

  const punchOn = useCallback(
    (dateISO: string, type: PunchType, time: string) => {
      const current = stateRef.current
      const punchValue = buildPunch(dateISO, type, time, current.settings)
      const existing = current.records[dateISO] ?? { date: dateISO, punches: [] }
      const at = new Date(punchValue.at)
      const duplicate = existing.punches.some((p) => {
        if (p.type !== type) return false
        return new Date(p.at).getTime() === at.getTime()
      })
      if (duplicate) return
      const punches = [...existing.punches, punchValue].sort(
        (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
      )
      commit({ ...current.records, [dateISO]: { ...existing, punches } }, [dateISO], [])
    },
    [commit],
  )

  const removeLastPunch = useCallback(() => {
    const current = stateRef.current
    const key = attendanceDayKey(new Date(), current.settings)
    const record = current.records[key]
    if (!record || record.punches.length === 0) return
    const punches = record.punches.slice(0, -1)
    const records = { ...current.records }
    if (punches.length === 0 && !record.leaveMinutes) {
      delete records[key]
      commit(records, [], [key])
    } else {
      records[key] = { ...record, punches }
      commit(records, [key], [])
    }
  }, [commit])

  const saveDay = useCallback(
    (dateISO: string, data: DayInput) => {
      const current = stateRef.current
      const punches = buildPunches(dateISO, data.ranges, current.settings)
      const records = { ...current.records }
      const isEmpty =
        punches.length === 0 && !data.leaveMinutes && !data.note && !data.approvedOvertimeMinutes
      if (isEmpty) {
        delete records[dateISO]
        commit(records, [], [dateISO])
      } else {
        records[dateISO] = {
          date: dateISO,
          punches,
          leaveMinutes: data.leaveMinutes || undefined,
          note: data.note?.trim() || undefined,
          approvedOvertimeMinutes: data.approvedOvertimeMinutes || undefined,
        }
        commit(records, [dateISO], [])
      }
    },
    [commit],
  )

  const deleteDay = useCallback(
    (dateISO: string) => {
      const records = { ...stateRef.current.records }
      delete records[dateISO]
      commit(records, [], [dateISO])
    },
    [commit],
  )

  const importRecords = useCallback(
    async (incoming: DayRecord[], mode: ImportMode): Promise<number> => {
      const current = stateRef.current
      const records = { ...current.records }
      const changed: string[] = []
      for (const item of incoming) {
        if (!item.date) continue
        const existing = records[item.date]
        if (existing && mode === 'skip') continue
        if (existing && mode === 'merge') {
          const seen = new Set(existing.punches.map((p) => `${p.type}@${new Date(p.at).getTime()}`))
          const extra = item.punches.filter(
            (p) => !seen.has(`${p.type}@${new Date(p.at).getTime()}`),
          )
          records[item.date] = {
            date: item.date,
            punches: [...existing.punches, ...extra].sort(
              (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
            ),
            leaveMinutes: item.leaveMinutes ?? existing.leaveMinutes,
            meetingMinutes: item.meetingMinutes ?? existing.meetingMinutes,
            approvedOvertimeMinutes:
              item.approvedOvertimeMinutes ?? existing.approvedOvertimeMinutes,
            note: item.note ?? existing.note,
          }
        } else {
          records[item.date] = item
        }
        changed.push(item.date)
      }
      if (!changed.length) return 0
      commit(records, changed, [])
      return changed.length
    },
    [commit],
  )

  const resetDemo = useCallback(() => {
    const seeded = SeedDemoData()
    const records = { ...stateRef.current.records, ...seeded.records }
    commit(records, Object.keys(seeded.records), [])
  }, [commit])

  const clearAll = useCallback(() => {
    const removed = Object.keys(stateRef.current.records)
    apply({ ...stateRef.current, records: {} })
    if (!userId || !removed.length) return
    void removeAllDayRecords(userId)
      .then(() => setServerState('saved'))
      .catch(() => setServerState('offline'))
  }, [apply, userId])

  const refresh = useCallback(async () => {
    if (!userId) return
    setServerState('syncing')
    try {
      const [profile, rows] = await Promise.all([fetchProfile(userId), fetchDayRecords(userId)])
      const records = rowsToRecords(rows)
      const settings = profileRowToSettings(profile, stateRef.current.settings)
      apply({ settings, records })
      writeJSON(cacheKey(userId), { settings, records })
      setServerState('saved')
      await drainQueue()
    } catch {
      setServerState('offline')
    }
  }, [apply, drainQueue, userId])

  const migrateLegacy = useCallback(async (): Promise<number> => {
    const raw = readJSON<{ settings?: Settings; records?: Records }>(LEGACY_KEY)
    if (!raw?.records) return 0
    const current = stateRef.current
    const merged = { ...raw.records, ...current.records }
    const count = Object.keys(raw.records).length
    const settings: Settings = {
      ...current.settings,
      fullName: current.settings.fullName || raw.settings?.fullName || '',
      jobTitle: current.settings.jobTitle || raw.settings?.jobTitle || '',
      unit: current.settings.unit || raw.settings?.unit || '',
      org: current.settings.org || raw.settings?.org || '',
    }
    apply({ settings, records: merged })
    if (userId) {
      localStorage.setItem(migratedKey(userId), '1')
      try {
        await pushDayRecords(
          userId,
          Object.values(raw.records)
            .filter((record) => record && record.date)
            .map(recordToRow),
        )
        await saveProfile(userId, settings)
        setServerState('saved')
      } catch {
        setServerState('offline')
      }
    }
    localStorage.removeItem(LEGACY_KEY)
    setLegacy(null)
    return count
  }, [apply, userId])

  const dismissLegacy = useCallback(() => {
    // داده‌های قدیمی از دید کاربرهای دیگر این دستگاه هم پنهان می‌شود
    const raw = localStorage.getItem(LEGACY_KEY)
    if (raw) {
      try {
        localStorage.setItem(`${LEGACY_KEY}.dismissed`, raw)
      } catch {
        /* ignore quota */
      }
      localStorage.removeItem(LEGACY_KEY)
    }
    if (userId) localStorage.setItem(migratedKey(userId), '1')
    setLegacy(null)
  }, [userId])

  const todayPunches = useMemo(
    () => state.records[attendanceDayKey(new Date(), state.settings)]?.punches ?? [],
    [state.records, state.settings],
  )

  const value = useMemo<StoreValue>(
    () => ({
      settings: state.settings,
      records: state.records,
      loading,
      serverState,
      userEmail,
      updateSettings,
      punch,
      punchOn,
      removeLastPunch,
      saveDay,
      deleteDay,
      importRecords,
      resetDemo,
      clearAll,
      refresh,
      todayPunches,
      legacy,
      migrateLegacy,
      dismissLegacy,
    }),
    [
      state.settings,
      state.records,
      loading,
      serverState,
      userEmail,
      updateSettings,
      punch,
      punchOn,
      removeLastPunch,
      saveDay,
      deleteDay,
      importRecords,
      resetDemo,
      clearAll,
      refresh,
      todayPunches,
      legacy,
      migrateLegacy,
      dismissLegacy,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
