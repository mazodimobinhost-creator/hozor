import { shiftWindow, type MonthStats } from '../lib/calc'
import type { Settings } from '../lib/types'
import {
  PERSIAN_MONTHS,
  faDigits,
  formatDuration,
  minutesOfDay,
  pad2,
} from '../lib/jalali'
import { Icon } from './Icons'
import { exportMonthToCsv, exportMonthToExcel } from '../lib/export'

const clock = (iso?: string) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return faDigits(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`)
}

export function ReportsScreen({
  stats,
  jy,
  jm,
  settings,
  onToast,
}: {
  stats: MonthStats
  jy: number
  jm: number
  settings: Settings
  onToast: (msg: string) => void
}) {
  const maxMinutes = Math.max(60, ...stats.days.map((d) => d.workedMinutes))

  return (
    <div className="report-grid">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <section className="card">
          <div className="card-head">
            <div className="card-title">
              کارکرد روزانه · {PERSIAN_MONTHS[jm - 1]} {faDigits(jy)}
            </div>
            <div className="spacer" />
            <button
              className="btn btn-sm btn-primary"
              onClick={() => {
                void exportMonthToExcel(jy, jm, stats, settings).then(() =>
                  onToast('فایل اکسل ماه ساخته شد'),
                )
              }}
            >
              <Icon name="download" size={14} /> خروجی اکسل
            </button>
            <button
              className="btn btn-sm"
              onClick={() => {
                exportMonthToCsv(jy, jm, stats)
                onToast('فایل CSV ساخته شد')
              }}
            >
              CSV
            </button>
          </div>
          <div className="card-body">
            <div className="bars">
              {stats.days.map((d) => {
                const h = Math.max(0, Math.min(100, (d.workedMinutes / maxMinutes) * 100))
                return (
                  <div className="bar-col" key={d.key} title={`${faDigits(d.day)} — ${formatDuration(d.workedMinutes)}`}>
                    <div
                      className={`bar ${d.isWeekend ? 'is-weekend' : ''} ${d.workedMinutes === 0 ? 'is-empty' : ''}`}
                      style={{ height: `${Math.max(3, h)}%` }}
                    />
                    <span className="bar-label">{faDigits(d.day)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div className="card-title">ریز کارکرد</div>
            <div className="spacer" />
            <span className="tiny muted">
              حضور {faDigits(stats.presentDays)} روز از {faDigits(stats.workdays)} روز کاری
            </span>
          </div>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>تاریخ</th>
                  <th>روز</th>
                  <th>ورود</th>
                  <th>خروج</th>
                  <th>کارکرد</th>
                  <th>اضافه‌کاری</th>
                  <th>تاخیر</th>
                  <th>مرخصی</th>
                </tr>
              </thead>
              <tbody>
                {stats.days.map((d) => (
                  <tr key={d.key}>
                    <td className="num">{faDigits(d.day)}</td>
                    <td>{['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'][d.weekday]}</td>
                    <td className="num c-teal">{clock(d.firstIn)}</td>
                    <td className="num c-red">{clock(d.lastOut)}</td>
                    <td className="num c-green">
                      {d.workedMinutes ? formatDuration(d.workedMinutes) : '—'}
                    </td>
                    <td className="num c-violet">
                      {d.overtimeMinutes ? formatDuration(d.overtimeMinutes) : '—'}
                    </td>
                    <td className="num c-orange">
                      {d.lateMinutes ? `${faDigits(d.lateMinutes)}′` : '—'}
                    </td>
                    <td className="num c-blue">
                      {d.leaveMinutes ? formatDuration(d.leaveMinutes) : d.isWeekend ? 'تعطیل' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <section className="card">
          <div className="card-head">
            <div className="card-title">جمع‌بندی ماه</div>
          </div>
          <div className="card-body">
            <div className="kv">
              <span className="kv-k">مجموع کارکرد</span>
              <span className="kv-v c-green">{formatDuration(stats.totalWorked)}</span>
            </div>
            <div className="kv">
              <span className="kv-k">کارکرد داخل شیفت</span>
              <span className="kv-v c-teal">{formatDuration(stats.inShiftMinutes)}</span>
            </div>
            <div className="kv">
              <span className="kv-k">اضافه‌کاری تایید شده</span>
              <span className="kv-v c-violet">{formatDuration(stats.approvedOvertime)}</span>
            </div>
            <div className="kv">
              <span className="kv-k">اضافه‌کاری تایید نشده</span>
              <span className="kv-v c-slate">{formatDuration(stats.pendingOvertime)}</span>
            </div>
            <div className="kv">
              <span className="kv-k">کسر کار / کم‌کاری</span>
              <span className="kv-v c-red">{formatDuration(stats.deficitMinutes)}</span>
            </div>
            <div className="kv">
              <span className="kv-k">تاخیر کل</span>
              <span className="kv-v c-orange">{formatDuration(stats.lateMinutes)}</span>
            </div>
            <div className="kv">
              <span className="kv-k">مرخصی استفاده‌شده</span>
              <span className="kv-v c-blue">{formatDuration(stats.leaveMinutes)}</span>
            </div>
            <div className="kv">
              <span className="kv-k">کار در روز تعطیل</span>
              <span className="kv-v c-amber">{formatDuration(stats.holidayWork)}</span>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div className="card-title">میانگین‌ها</div>
          </div>
          <div className="card-body">
            <div className="kv">
              <span className="kv-k">میانگین کارکرد روزانه</span>
              <span className="kv-v num">
                {formatDuration(stats.presentDays ? stats.totalWorked / stats.presentDays : 0)}
              </span>
            </div>
            <div className="kv">
              <span className="kv-k">میانگین تاخیر روزانه</span>
              <span className="kv-v num c-orange">
                {faDigits(Math.round(stats.lateMinutes / Math.max(1, stats.workdays)))} دقیقه
              </span>
            </div>
            <div className="kv">
              <span className="kv-k">روزهای غیبت / ثبت‌نشده</span>
              <span className="kv-v num c-red">
                {faDigits(
                  stats.days.filter((d) => !d.isWeekend && !d.isFuture && d.status === 'empty').length,
                )}
              </span>
            </div>
            <div className="kv">
              <span className="kv-k">شیفت موظفی روزانه</span>
              <span className="kv-v num">
                {formatDuration(shiftWindow(settings).required)}
              </span>
            </div>
          </div>
        </section>

        <div className="notice">
          <Icon name="info" size={16} />
          <div>
            خروجی اکسل شامل همه روزهای ماه، ساعت ورود و خروج، کارکرد، اضافه‌کاری، تاخیر و مرخصی است و
            برای ارسال به واحد پرسنلی آماده است. داده‌ها روی همین گوشی ذخیره می‌شوند.
          </div>
        </div>
      </div>
    </div>
  )
}
