import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { buildSummary } from '../lib/calc'
import {
  faDigits,
  formatDuration,
  formatJalaliLong,
  pad2,
  parseDayKey,
  persianWeekday,
  weekdayLabel,
} from '../lib/jalali'
import { Icon } from './Icons'
import { DayEditor } from './DayEditor'
import { JalaliDatePicker, todayKey } from './JalaliDatePicker'
import type { Settings } from '../lib/types'

export function ManualEntryScreen({
  settings,
  onToast,
}: {
  settings: Settings
  onToast: (msg: string) => void
}) {
  const { records, deleteDay, addPunch, updatePunch, removePunch } = useStore()
  const [dateISO, setDateISO] = useState<string>(() => todayKey())
  const [customTime, setCustomTime] = useState('')
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const nowClock = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`
  const clockOf = (iso: string) => {
    const date = new Date(iso)
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
  }

  const record = records[dateISO]
  const summary = useMemo(
    () => buildSummary(parseDayKey(dateISO), record, settings, new Date()),
    [dateISO, record, settings],
  )

  const recent = useMemo(() => {
    return Object.values(records)
      .filter((r) => r.punches.length > 0 || r.leaveMinutes)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 12)
      .map((r) => ({ record: r, summary: buildSummary(parseDayKey(r.date), r, settings, new Date()) }))
  }, [records, settings])

  const punches = record?.punches ?? []

  const quickPunch = (type: 'in' | 'out', time?: string) => {
    addPunch(dateISO, type, time)
    onToast(`${type === 'in' ? 'ورود' : 'خروج'} ${faDigits(time ?? nowClock)} ثبت شد`)
  }

  return (
    <div className="report-grid">
      <section className="card">
        <div className="card-head">
          <div className="card-title">ثبت ورود و خروج</div>
          <div className="spacer" />
          <span className="chip chip-blue">
            {formatJalaliLong(parseDayKey(dateISO))} · {weekdayLabel(persianWeekday(parseDayKey(dateISO)))}
          </span>
        </div>
        <div className="card-body">
          <div className="quick-punch-grid">
            <button className="quick-punch in" onClick={() => quickPunch('in')}>
              <span className="qp-icon">
                <Icon name="login" size={22} />
              </span>
              <span className="qp-title">ثبت ورود</span>
              <span className="qp-sub num">{faDigits(nowClock)} — الان</span>
            </button>
            <button className="quick-punch out" onClick={() => quickPunch('out')}>
              <span className="qp-icon">
                <Icon name="logout" size={22} />
              </span>
              <span className="qp-title">ثبت خروج</span>
              <span className="qp-sub num">{faDigits(nowClock)} — الان</span>
            </button>
          </div>

          <div className="custom-time">
            <input
              className="input num"
              type="time"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
              aria-label="ساعت دلخواه"
            />
            <button
              className="btn btn-sm"
              disabled={!customTime}
              onClick={() => {
                quickPunch('in', customTime)
                setCustomTime('')
              }}
            >
              ورود با این ساعت
            </button>
            <button
              className="btn btn-sm"
              disabled={!customTime}
              onClick={() => {
                quickPunch('out', customTime)
                setCustomTime('')
              }}
            >
              خروج با این ساعت
            </button>
          </div>

          <div className="punch-list">
            {punches.length === 0 ? (
              <div className="tiny muted">
                هنوز ورود/خروجی برای این روز ثبت نشده. با دکمه‌ها ثبت کن — برای ورود دوم، دوباره
                «ثبت ورود» را بزن.
              </div>
            ) : (
              punches.map((punch, index) => (
                <div className={`punch-item ${punch.type}`} key={`${punch.at}-${index}`}>
                  <span className={`punch-item-tag ${punch.type}`}>
                    {punch.type === 'in' ? 'ورود' : 'خروج'}
                  </span>
                  <input
                    className="input num punch-item-time"
                    type="time"
                    value={clockOf(punch.at)}
                    onChange={(e) => updatePunch(dateISO, index, e.target.value)}
                    aria-label="ویرایش ساعت"
                  />
                  {new Date(punch.at).getDate() !== parseDayKey(dateISO).getDate() && (
                    <span className="tiny muted">بامداد روز بعد</span>
                  )}
                  <div className="spacer" />
                  <button
                    className="icon-btn"
                    aria-label="حذف این ثبت"
                    onClick={() => {
                      removePunch(dateISO, index)
                      onToast('این ثبت حذف شد')
                    }}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          {punches.length > 0 && (
            <div className="punch-summary">
              <span>
                کارکرد <b className="num c-green">{formatDuration(summary.workedMinutes)}</b>
              </span>
              <span className="ot-inline">
                اضافه‌کاری <b className="num">{formatDuration(summary.overtimeMinutes)}</b>
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div className="card-title">ثبت دستی روز</div>
          <div className="spacer" />
          <span className="chip chip-orange">بدون محدودیت زمانی</span>
        </div>
        <div className="card-body">
          <div className="notice" style={{ marginBottom: 16 }}>
            <Icon name="info" size={16} />
            <div>
              روز مورد نظر را انتخاب کنید و ساعت ورود و خروج خودتان را وارد کنید — برای امروز، دیروز یا
              هر روز دیگر از ماه‌های گذشته.
            </div>
          </div>

          <DayEditor
            key={dateISO}
            dateISO={dateISO}
            record={record}
            showDatePicker
            onChangeDate={setDateISO}
            weekendDays={settings.weekendDays}
            onDone={onToast}
          />
        </div>
      </section>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <section className="card">
          <div className="card-head">
            <div className="card-title">انتخاب سریع روز</div>
          </div>
          <div className="card-body" style={{ paddingTop: 12 }}>
            <JalaliDatePicker
              value={dateISO}
              onChange={setDateISO}
              weekendDays={settings.weekendDays}
              label="رفتن به تاریخ"
            />
            <div className="kv" style={{ marginTop: 10 }}>
              <span className="kv-k">وضعیت روز انتخابی</span>
              <span className="kv-v">
                {summary.workedMinutes > 0
                  ? `کارکرد ${formatDuration(summary.workedMinutes)}`
                  : summary.leaveMinutes > 0
                    ? 'مرخصی'
                    : 'ثبت نشده'}
              </span>
            </div>
            <div className="kv">
              <span className="kv-k">تاریخ</span>
              <span className="kv-v num">
                {formatJalaliLong(parseDayKey(dateISO))} · {weekdayLabel(persianWeekday(parseDayKey(dateISO)))}
              </span>
            </div>
            <div className="kv">
              <span className="kv-k">شیفت موظفی</span>
              <span className="kv-v num">
                {faDigits(settings.shiftStart)} تا {faDigits(settings.shiftEnd)}
              </span>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div className="card-title">ثبت‌های اخیر</div>
            <div className="spacer" />
            <span className="tiny muted">برای ویرایش لمس کنید</span>
          </div>
          <div className="card-body" style={{ paddingTop: 6, paddingBottom: 8 }}>
            {recent.length === 0 && <div className="empty-state">هنوز ثبتی وجود ندارد</div>}
            {recent.map(({ record: r, summary: s }) => (
              <div className="recent-item" key={r.date}>
                <button className="recent-main" onClick={() => setDateISO(r.date)}>
                  <span className="recent-date">
                    <b className="num">{faDigits(s.day)}</b>
                    <span>{weekdayLabel(s.weekday)}</span>
                  </span>
                  <span className="recent-times num">
                    {s.firstIn ? faDigits(pad2(new Date(s.firstIn).getHours()) + ':' + pad2(new Date(s.firstIn).getMinutes())) : '—'}
                    {' ← '}
                    {s.lastOut
                      ? faDigits(pad2(new Date(s.lastOut).getHours()) + ':' + pad2(new Date(s.lastOut).getMinutes()))
                      : '—'}
                  </span>
                  <span className="chip chip-green num">{formatDuration(s.workedMinutes)}</span>
                </button>
                <button
                  className="icon-btn"
                  aria-label="پاک کردن"
                  onClick={() => {
                    deleteDay(r.date)
                    onToast('ثبت این روز پاک شد')
                  }}
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            ))}
          </div>
        </section>

        <div className="notice warn">
          <Icon name="info" size={16} />
          <div>
            اگر موقع ثبت خروج یادت رفت، نگران نباش: در همین صفحه روز را انتخاب کن، ساعت خروج واقعی را
            بزن و ذخیره کن. روزهایی که خروج ثبت نشده باشد با برچسب «خروج ثبت نشده» مشخص می‌شوند.
          </div>
        </div>
      </div>
    </div>
  )
}
