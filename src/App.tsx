import { useCallback, useEffect, useMemo, useState } from 'react'
import { StoreProvider, useStore } from './lib/store'
import { AuthProvider, useAuth } from './lib/auth'
import { AuthScreen } from './components/AuthScreen'
import { ImportScreen } from './components/ImportScreen'
import { computeMonth } from './lib/calc'
import { PERSIAN_MONTHS, faDigits, formatJalaliLong, shiftMonth, toJalali } from './lib/jalali'
import type { DaySummary } from './lib/types'
import { TopBar } from './components/TopBar'
import { StatCards } from './components/StatCards'
import { CalendarCard } from './components/CalendarCard'
import { DaySheet } from './components/DaySheet'
import { PunchTab } from './components/PunchTab'
import { ReportsScreen } from './components/ReportsScreen'
import { ProfileScreen } from './components/ProfileScreen'
import { Icon } from './components/Icons'
import { exportMonthToExcel } from './lib/export'
import { applyPwaUpdate, onPwaUpdateState } from './lib/pwa'
import { checkForUpdate, isNativeApp, openExternal, type ReleaseInfo } from './lib/updates'

export type Tab = 'home' | 'punch' | 'reports' | 'import' | 'profile'

const navItems: {
  id: Tab
  label: string
  icon: 'calendar' | 'login' | 'chart' | 'upload' | 'userCircle'
}[] = [
  { id: 'home', label: 'تقویم', icon: 'calendar' },
  { id: 'punch', label: 'ثبت', icon: 'login' },
  { id: 'reports', label: 'گزارش', icon: 'chart' },
  { id: 'import', label: 'ایمپورت', icon: 'upload' },
  { id: 'profile', label: 'من', icon: 'userCircle' },
]

function Shell() {
  const { settings, records, legacy, migrateLegacy, dismissLegacy, serverState, syncError, syncNow } =
    useStore()
  const today = new Date()
  const initial = toJalali(today)

  const [tab, setTab] = useState<Tab>('home')
  const [month, setMonth] = useState({ jy: initial.jy, jm: initial.jm })
  const [selected, setSelected] = useState<DaySummary | null>(null)
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null)
  const [now, setNow] = useState(new Date())
  const [needRefresh, setNeedRefresh] = useState(false)
  const [refreshDismissed, setRefreshDismissed] = useState(false)
  const [nativeUpdate, setNativeUpdate] = useState<ReleaseInfo | null>(null)

  useEffect(() => onPwaUpdateState(setNeedRefresh), [])

  // بررسی خودکار نسخه جدید در اپ اندروید/آیفون
  useEffect(() => {
    if (!isNativeApp()) return
    const id = window.setTimeout(async () => {
      const result = await checkForUpdate()
      if (result.hasUpdate && result.latest) setNativeUpdate(result.latest)
    }, 2500)
    return () => window.clearTimeout(id)
  }, [])

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

            {legacy && (
              <section className="card legacy-card">
                <div className="card-body legacy-body">
                  <div>
                    <div className="card-title">داده‌های قبلی این دستگاه</div>
                    <div className="tiny muted">
                      <span className="num">{faDigits(legacy.recordCount)}</span> روز ثبت‌شده از نسخه
                      قبل (بدون لاگین) روی این دستگاه پیدا شد. به حساب خودتان منتقل شود؟
                    </div>
                  </div>
                  <div className="legacy-actions">
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        void migrateLegacy().then((count) =>
                          showToast(`داده ${faDigits(count)} روز منتقل شد`),
                        )
                      }}
                    >
                      انتقال به حساب من
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={dismissLegacy}>
                      لازم نیست
                    </button>
                  </div>
                </div>
              </section>
            )}

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

        {tab === 'punch' && <PunchTab settings={settings} onToast={showToast} />}

        {tab === 'import' && (
          <>
            <div className="month-bar">
              <div>
                <div className="month-title">ایمپورت کارکرد</div>
                <div className="tiny muted">
                  فایل اکسل را با لینک یا از گوشی بیاورید
                  {serverState === 'offline' ? ' · آفلاین' : ''}
                </div>
              </div>
            </div>
            <ImportScreen onToast={showToast} />
          </>
        )}

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

      {nativeUpdate && !refreshDismissed && (
        <div className="update-banner" role="status">
          <span className="update-dot" />
          <span className="update-text num">نسخه {nativeUpdate.version} آماده است</span>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => void openExternal(nativeUpdate.apkUrl ?? nativeUpdate.pageUrl)}
          >
            دریافت
          </button>
          <button className="icon-btn" aria-label="بستن" onClick={() => setRefreshDismissed(true)}>
            <Icon name="x" size={15} />
          </button>
        </div>
      )}

      {needRefresh && !refreshDismissed && (
        <div className="update-banner" role="status">
          <span className="update-dot" />
          <span className="update-text">نسخه جدید اپ آماده است</span>
          <button
            className="btn btn-sm btn-primary"
            onClick={async () => {
              showToast('در حال به‌روزرسانی…')
              await applyPwaUpdate()
            }}
          >
            بروزرسانی
          </button>
          <button className="icon-btn" aria-label="بستن" onClick={() => setRefreshDismissed(true)}>
            <Icon name="x" size={15} />
          </button>
        </div>
      )}

      {syncError && (
        <div className="sync-error-banner" role="status">
          <Icon name="info" size={16} />
          <span>{syncError}</span>
          <button
            className="btn btn-sm btn-primary"
            onClick={async () => {
              const ok = await syncNow()
              showToast(ok ? 'همه ثبت‌ها روی سرور ذخیره شد' : 'باز هم نشد؛ اتصال را بررسی کنید')
            }}
          >
            تلاش دوباره
          </button>
        </div>
      )}

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

function BootSplash() {
  return (
    <div className="boot">
      <div className="boot-mark">
        <Icon name="calendarCheck" size={26} />
      </div>
      <div className="boot-text">در حال آماده‌سازی…</div>
    </div>
  )
}

function Gate() {
  const { session, loading } = useAuth()
  if (loading) return <BootSplash />
  if (!session) return <AuthScreen />
  return (
    <StoreProvider key={session.user.id}>
      <Shell />
    </StoreProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
