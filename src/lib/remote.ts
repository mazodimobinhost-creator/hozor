import type { Punch, Settings } from './types'
import { getSupabase } from './supabase'

/** سطر جدول profiles */
export interface ProfileRow {
  id: string
  full_name: string | null
  job_title: string | null
  unit: string | null
  org: string | null
  shift_start: string | null
  shift_end: string | null
  break_minutes: number | null
  weekend_days: number[] | null
  monthly_leave_minutes: number | null
}

/** سطر جدول day_records */
export interface DayRecordRow {
  day: string
  punches: Punch[] | null
  leave_minutes: number | null
  meeting_minutes: number | null
  approved_overtime_minutes: number | null
  note: string | null
}

export function settingsToProfileRow(userId: string, settings: Settings) {
  return {
    id: userId,
    full_name: settings.fullName,
    job_title: settings.jobTitle,
    unit: settings.unit,
    org: settings.org,
    shift_start: settings.shiftStart,
    shift_end: settings.shiftEnd,
    break_minutes: settings.breakMinutes,
    weekend_days: settings.weekendDays,
    monthly_leave_minutes: settings.monthlyLeaveMinutes,
  }
}

export function profileRowToSettings(
  row: Partial<ProfileRow> | null | undefined,
  fallback: Settings,
): Settings {
  if (!row) return fallback
  return {
    fullName: row.full_name ?? fallback.fullName,
    jobTitle: row.job_title ?? fallback.jobTitle,
    unit: row.unit ?? fallback.unit,
    org: row.org ?? fallback.org,
    shiftStart: row.shift_start || fallback.shiftStart,
    shiftEnd: row.shift_end || fallback.shiftEnd,
    breakMinutes: row.break_minutes ?? fallback.breakMinutes,
    weekendDays:
      Array.isArray(row.weekend_days) && row.weekend_days.length
        ? row.weekend_days
        : fallback.weekendDays,
    monthlyLeaveMinutes: row.monthly_leave_minutes ?? fallback.monthlyLeaveMinutes,
  }
}

export async function fetchProfile(userId: string): Promise<Partial<ProfileRow> | null> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as Partial<ProfileRow> | null) ?? null
}

export async function saveProfile(userId: string, settings: Settings): Promise<void> {
  const { error } = await getSupabase()
    .from('profiles')
    .upsert(settingsToProfileRow(userId, settings), { onConflict: 'id' })
  if (error) throw error
}

export async function fetchDayRecords(userId: string): Promise<DayRecordRow[]> {
  const { data, error } = await getSupabase()
    .from('day_records')
    .select('day,punches,leave_minutes,meeting_minutes,approved_overtime_minutes,note')
    .eq('user_id', userId)
    .order('day', { ascending: false })
  if (error) throw error
  return (data ?? []) as DayRecordRow[]
}

/** چند رکورد را یک‌جا ذخیره می‌کند (upsert روی (user_id, day)) */
export async function pushDayRecords(
  userId: string,
  rows: {
    day: string
    punches: Punch[]
    leave_minutes: number | null
    meeting_minutes: number | null
    approved_overtime_minutes: number | null
    note: string | null
  }[],
): Promise<void> {
  if (!rows.length) return
  const payload = rows.map((row) => ({ ...row, user_id: userId }))
  const { error } = await getSupabase()
    .from('day_records')
    .upsert(payload, { onConflict: 'user_id,day' })
  if (error) throw error
}

export async function removeDayRecords(userId: string, days: string[]): Promise<void> {
  if (!days.length) return
  const { error } = await getSupabase()
    .from('day_records')
    .delete()
    .eq('user_id', userId)
    .in('day', days)
  if (error) throw error
}

export async function removeAllDayRecords(userId: string): Promise<void> {
  const { error } = await getSupabase().from('day_records').delete().eq('user_id', userId)
  if (error) throw error
}
