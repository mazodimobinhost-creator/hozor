import type { Settings } from './types'
import type { MonthStats } from './calc'
import {
  pad2,
  parseDayKey,
  toJalali,
  PERSIAN_MONTHS,
  PERSIAN_WEEKDAYS,
  faDigits,
  formatDuration,
} from './jalali'

const clock = (iso?: string) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export async function exportMonthToExcel(jy: number, jm: number, stats: MonthStats, settings: Settings) {
  const rows: (string | number)[][] = []
  rows.push(['گزارش حضور و غیاب ماهانه'])
  rows.push(['نام و نام خانوادگی', settings.fullName, 'واحد', settings.unit])
  rows.push(['ماه', `${PERSIAN_MONTHS[jm - 1]} ${jy}`, 'شیفت', `${settings.shiftStart} - ${settings.shiftEnd}`])
  rows.push([])
  rows.push(['تاریخ', 'روز هفته', 'ورود', 'خروج', 'کارکرد', 'اضافه‌کاری', 'تاخیر (دقیقه)', 'مرخصی', 'جلسه', 'توضیح'])

  for (const d of stats.days) {
    rows.push([
      (() => {
        const j = toJalali(parseDayKey(d.key))
        return `${j.jy}/${pad2(j.jm)}/${pad2(j.jd)}`
      })(),
      PERSIAN_WEEKDAYS[d.weekday],
      clock(d.firstIn),
      clock(d.lastOut),
      d.punches.length || d.leaveMinutes ? formatDuration(d.workedMinutes) : '—',
      d.overtimeMinutes ? formatDuration(d.overtimeMinutes) : '—',
      d.lateMinutes || '—',
      d.leaveMinutes ? formatDuration(d.leaveMinutes) : '—',
      d.meetingMinutes ? formatDuration(d.meetingMinutes) : '—',
      d.isWeekend ? 'تعطیل' : d.status === 'leave' ? 'مرخصی' : d.status === 'empty' ? 'ثبت نشده' : '',
    ])
  }

  rows.push([])
  rows.push(['جمع کارکرد', formatDuration(stats.totalWorked)])
  rows.push(['اضافه‌کاری تایید شده', formatDuration(stats.approvedOvertime)])
  rows.push(['اضافه‌کاری تایید نشده', formatDuration(stats.pendingOvertime)])
  rows.push(['تاخیر کل', formatDuration(stats.lateMinutes)])
  rows.push(['مرخصی', formatDuration(stats.leaveMinutes)])
  rows.push(['خارج از شیفت', formatDuration(stats.outOfShiftMinutes)])
  rows.push(['تعطیل‌کاری', formatDuration(stats.holidayWork)])
  rows.push(['روزهای حضور', `${stats.presentDays} از ${stats.workdays}`])

  const XLSX = await import('xlsx')
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!cols'] = [
    { wch: 12 },
    { wch: 12 },
    { wch: 9 },
    { wch: 9 },
    { wch: 10 },
    { wch: 11 },
    { wch: 12 },
    { wch: 9 },
    { wch: 9 },
    { wch: 14 },
  ]
  sheet['!rtl'] = true
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, 'حضور و غیاب')
  XLSX.writeFile(wb, `hozor-${jy}-${String(jm).padStart(2, '0')}.xlsx`)
}

export function exportMonthToCsv(jy: number, jm: number, stats: MonthStats) {
  const lines: string[] = []
  lines.push('تاریخ,روز,ورود,خروج,کارکرد,اضافه‌کاری,تاخیر,مرخصی')
  for (const d of stats.days) {
    lines.push(
      [
        (() => {
          const j = toJalali(parseDayKey(d.key))
          return `${j.jy}/${pad2(j.jm)}/${pad2(j.jd)}`
        })(),
        PERSIAN_WEEKDAYS[d.weekday],
        clock(d.firstIn),
        clock(d.lastOut),
        formatDuration(d.workedMinutes, false),
        formatDuration(d.overtimeMinutes, false),
        d.lateMinutes,
        formatDuration(d.leaveMinutes, false),
      ].join(','),
    )
  }
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `hozor-${jy}-${String(jm).padStart(2, '0')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
