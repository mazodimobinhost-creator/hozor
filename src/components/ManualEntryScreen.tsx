import { useMemo, useState } from 'react'
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
  const { records, deleteDay } = useStore()
  const [dateISO, setDateISO] = useState<string>(() => todayKey())

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

  return (
    <div className="report-grid">
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
