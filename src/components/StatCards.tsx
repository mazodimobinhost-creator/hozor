import type { MonthStats } from '../lib/calc'
import { formatDuration, formatDuration as dur } from '../lib/jalali'
import { Icon, type IconName } from './Icons'

interface CardDef {
  key: keyof MonthStats
  label: string
  icon: IconName
  color: string
}

const cards: CardDef[] = [
  { key: 'inShiftMinutes', label: 'ساعت کاری', icon: 'home', color: 'c-teal' },
  { key: 'pendingOvertime', label: 'اضافه‌کاری تایید نشده', icon: 'clock', color: 'c-slate' },
  { key: 'approvedOvertime', label: 'اضافه‌کاری تایید شده', icon: 'plus', color: 'c-violet' },
  { key: 'meetingMinutes', label: 'کسر کار جلسات', icon: 'minus', color: 'c-red' },
  { key: 'outOfShiftMinutes', label: 'خارج از شیفت', icon: 'calendar', color: 'c-orange' },
  { key: 'holidayWork', label: 'تعطیل کاری', icon: 'star', color: 'c-amber' },
  { key: 'lateMinutes', label: 'تاخیر این ماه', icon: 'alarm', color: 'c-orange' },
  { key: 'leaveMinutes', label: 'ساعت مرخصی', icon: 'calendarCheck', color: 'c-blue' },
  { key: 'totalWorked', label: 'ساعت کارکرد', icon: 'chart', color: 'c-green' },
]

export function StatCards({ stats, loading }: { stats: MonthStats; loading?: boolean }) {
  return (
    <section className="stats" aria-label="خلاصه ماه">
      {cards.map((c) => {
        const value = stats[c.key] as number
        return (
          <article className="stat" key={c.key} title={c.label}>
            <div className="stat-head">
              <Icon name={c.icon} size={17} />
              <span>{c.label}</span>
            </div>
            <div className={`stat-value ${c.color} num`}>{loading ? '…' : formatDuration(value)}</div>
          </article>
        )
      })}
    </section>
  )
}

export { dur }
