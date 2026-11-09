import { useCallback, useEffect, useMemo, useState } from 'react'
import { StoreProvider, useStore } from './lib/store'
import { computeMonth } from './lib/calc'
import { PERSIAN_MONTHS, faDigits, formatJalaliLong, shiftMonth, toJalali } from './lib/jalali'
import type { DaySummary } from './lib/types'
import { TopBar } from './components/TopBar'
import { StatCards } from './components/StatCards'
import { CalendarCard } from './components/CalendarCard'
import { DaySheet } from './components/DaySheet'
import { PunchScreen } from './components/PunchScreen'
import { ReportsScreen } from './components/ReportsScreen'
import { ProfileScreen } from './components/ProfileScreen'
import { Icon } from './components/Icons'
import { exportMonthToExcel } from './lib/export'

export type Tab = 'home' | 'punch' | 'reports' | 'profile'

const navItems: { id: Tab; label: string; icon: 'calendar' | 'login' | 'chart' | 'userCircle' }[] = [
  { id: 'home', label: 'تقویم', icon: 'calendar' },
  { id: 'punch', label: 'ثبت', icon: 'login' },
  { id: 'reports', label: 'گزارش', icon: 'chart' },
  { id: 'profile', label: 'من', icon: 'userCircle' },
]

function Shell() {
  const { settings, records } = useStore()
  const today = new Date()
  const initial = toJalali(today)

  const [tab, setTab] = useState<Tab>('home')
  const [month, setMonth] = useState({ jy: initial.jy, jm: initial.jm })
  const [selected, setSelected] = useState<DaySummary | null>(null)
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast({ id: Date.now(), msg })
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(id)
  }, [toast])

  const stats = useMemo(
    () => computeMonth(month.jy, month.jm, records, settings, now),
    [month.jy, month.jm, records, settings, now],
  )

  const isCurrentMonth = month.jy === initial.jy && month.jm === initial.jm

  return (
    <div className="app">
      <TopBar settings={settings} tab={tab} onChangeTab={setTab} />

      <main className="page">
        {tab === 'home' && (
          <>
            <div className="month-bar">
              <div>
                <div className="month-title">
                  {PERSIAN_MONTHS[month.jm - 1]} <span className="num">{faDigits(month.jy)}</span>
                </div>
                <div className="tiny muted">
                  امروز: {formatJalaliLong(today)} · {settings.unit}
                </div>
              </div>

              <div className="spacer" />

              <div className="month-nav">
                <button
                  className="icon-btn"
                  onClick={() => setMonth((m) => shiftMonth(m.jy, m.jm, -1))}
                  aria-label="ماه قبل"
                >
                  <Icon name="chevronRight" size={17} />
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => setMonth({ jy: initial.jy, jm: initial.jm })}
                  disabled={isCurrentMonth}
                >
                  ماه جاری
                </button>
                <button
                  className="icon-btn"
                  onClick={() => setMonth((m) => shiftMonth(m.jy, m.jm, 1))}
                  aria-label="ماه بعد"
                >
                  <Icon name="chevronLeft" size={17} />
                </button>
              </div>

              <button
                className="btn btn-primary"
                onClick={() => {
                  void exportMonthToExcel(month.jy, month.jm, stats, settings).then(() =>
                    showToast('خروجی اکسل ماه ساخته شد'),
                  )
                }}
              >
                <Icon name="download" size={16} /> خروجی اکسل
              </button>
            </div>

            <StatCards stats={stats} />
            <CalendarCard
              jy={month.jy}
              jm={month.jm}
              records={records}
              settings={settings}
              now={now}
              onSelect={setSelected}
            />
          </>
        )}

        {tab === 'punch' && <PunchScreen settings={settings} onToast={showToast} />}

        {tab === 'reports' && (
          <>
            <div className="month-bar">
              <div>
                <div className="month-title">
                  گزارش {PERSIAN_MONTHS[month.jm - 1]} <span className="num">{faDigits(month.jy)}</span>
                </div>
                <div className="tiny muted">خلاصه کارکرد، تاخیر، اضافه‌کاری و خروجی اکسل</div>
              </div>
              <div className="spacer" />
              <div className="month-nav">
                <button
                  className="icon-btn"
                  onClick={() => setMonth((m) => shiftMonth(m.jy, m.jm, -1))}
                  aria-label="ماه قبل"
                >
                  <Icon name="chevronRight" size={17} />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => setMonth((m) => shiftMonth(m.jy, m.jm, 1))}
                  aria-label="ماه بعد"
                >
                  <Icon name="chevronLeft" size={17} />
                </button>
              </div>
            </div>
            <ReportsScreen
              stats={stats}
              jy={month.jy}
              jm={month.jm}
              settings={settings}
              onToast={showToast}
            />
          </>
        )}

        {tab === 'profile' && (
          <>
            <div className="month-bar">
              <div>
                <div className="month-title">پروفایل و تنظیمات</div>
                <div className="tiny muted">مشخصات، شیفت کاری و مدیریت داده‌ها</div>
              </div>
            </div>
            <ProfileScreen onToast={showToast} />
          </>
        )}
      </main>

      <nav className="bottom-nav">
        {navItems.map((n) => (
          <button
            key={n.id}
            className={`nav-item ${tab === n.id ? 'active' : ''}`}
            onClick={() => setTab(n.id)}
          >
            <Icon name={n.icon} size={21} />
            {n.label}
          </button>
        ))}
      </nav>

      <DaySheet
        summary={selected}
        settings={settings}
        onClose={() => setSelected(null)}
        onToast={showToast}
      />

      {toast && (
        <div className="toast" key={toast.id}>
          <div className="toast-inner">
            <Icon name="check" size={15} />
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
