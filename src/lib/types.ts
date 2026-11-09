export type PunchType = 'in' | 'out'

export interface Punch {
  type: PunchType
  /** ISO date-time string */
  at: string
  source?: 'mobile' | 'manual' | 'web'
}

export interface DayRecord {
  /** Gregorian ISO day key: YYYY-MM-DD (local) */
  date: string
  punches: Punch[]
  leaveMinutes?: number
  meetingMinutes?: number
  approvedOvertimeMinutes?: number
  note?: string
}

export interface Settings {
  fullName: string
  jobTitle: string
  unit: string
  /** "HH:MM" 24h */
  shiftStart: string
  shiftEnd: string
  /** minutes of paid break inside the shift */
  breakMinutes: number
  /** Persian weekday indexes that are weekend: 0=شنبه ... 6=جمعه */
  weekendDays: number[]
  monthlyLeaveMinutes: number
  org: string
}

export interface DaySummary {
  key: string
  day: number
  weekday: number
  isWeekend: boolean
  isHoliday: boolean
  isToday: boolean
  isFuture: boolean
  punches: Punch[]
  firstIn?: string
  lastOut?: string
  workedMinutes: number
  inShiftMinutes: number
  outOfShiftMinutes: number
  overtimeMinutes: number
  approvedOvertimeMinutes: number
  pendingOvertimeMinutes: number
  lateMinutes: number
  earlyLeaveMinutes: number
  meetingMinutes: number
  leaveMinutes: number
  deficitMinutes: number
  status: 'off' | 'leave' | 'open' | 'closed' | 'empty' | 'holiday-work'
}
