import { useEffect, useState } from 'react'
import type { Settings } from '../lib/types'
import { formatClock, formatJalaliLong } from '../lib/jalali'
import { Icon } from './Icons'
import type { Tab } from '../App'

const tabs: {
  id: Tab
  label: string
  icon: 'calendar' | 'login' | 'chart' | 'upload' | 'user'
}[] = [
  { id: 'home', label: 'تقویم من', icon: 'calendar' },
  { id: 'punch', label: 'ثبت ورود و خروج', icon: 'login' },
  { id: 'reports', label: 'گزارش‌ها', icon: 'chart' },
  { id: 'import', label: 'ایمپورت اکسل', icon: 'upload' },
  { id: 'profile', label: 'پروفایل', icon: 'user' },
]

export function TopBar({
  settings,
  tab,
  onChangeTab,
}: {
  settings: Settings
  tab: Tab
  onChangeTab: (t: Tab) => void
}) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const initials = settings.fullName.trim().slice(0, 2)

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <div className="brand-mark">
            <Icon name="calendarCheck" size={21} />
          </div>
          <div className="brand-text">
            <div className="brand-title">حضور و غیاب من</div>
            <div className="brand-sub">خانه / حضور و غیاب من</div>
          </div>
        </div>

        <div className="topbar-spacer" />

        <nav className="top-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`top-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => onChangeTab(t.id)}
            >
              <Icon name={t.icon} size={15} />
              {t.label}
            </button>
          ))}
        </nav>

        <div className="topbar-meta">
          <div>
            آخرین به‌روزرسانی: <span className="num">{formatClock(now, true)}</span>
          </div>
          <div>{formatJalaliLong(now)}</div>
        </div>

        <button className="user-chip" onClick={() => onChangeTab('profile')} aria-label="پروفایل">
          <span className="user-name">{settings.fullName}</span>
          <span className="avatar">{initials}</span>
        </button>
      </div>
    </header>
  )
}
