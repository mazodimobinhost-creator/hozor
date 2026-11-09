import { useEffect, useMemo, useState } from 'react'
import type { DaySummary, PunchType, Settings } from '../lib/types'
import { useStore } from '../lib/store'
import { buildSummary, shiftWindow } from '../lib/calc'
import {
  dayKey,
  faDigits,
  formatDuration,
  formatJalaliLong,
  minutesToTime,
  pad2,
  parseDayKey,
  persianWeekday,
  weekdayLabel,
} from '../lib/jalali'
import { Icon } from './Icons'
import { DayEditor } from './DayEditor'

type Step = 'choose' | 'time' | 'edit'

const clockOf = (iso: string) => {
  const d = new Date(iso)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function DaySheet({
  summary,
  settings,
  onClose,
  onToast,
}: {
  summary: DaySummary | null
  settings: Settings
  onClose: () => void
  onToast: (msg: string) => void
}) {
  const { records, punchOn } = useStore()
  const [step, setStep] = useState<Step>('choose')
  const [type, setType] = useState<PunchType>('in')
  const [time, setTime] = useState('')
  const key = summary?.key ?? ''

  const live = useMemo(
    () => (key ? buildSummary(parseDayKey(key), records[key], settings, new Date()) : null),
    [key, records, settings],
  )

  const { overnight, endRaw } = shiftWindow(settings)
  const isToday = key === dayKey(new Date())

  useEffect(() => {
    setStep('choose')
  }, [key])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!summary || !live) return null

  const dateLabel = `${weekdayLabel(persianWeekday(parseDayKey(key)))} ${formatJalaliLong(parseDayKey(key))}`

  const startFlow = (t: PunchType) => {
    setType(t)
    const now = new Date()
    const nowTime = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`
    setTime(
      t === 'in'
        ? isToday && nowTime > settings.shiftStart
          ? nowTime
          : settings.shiftStart
        : isToday
          ? nowTime
          : minutesToTime(endRaw),
    )
    setStep('time')
  }

  const save = () => {
    if (!/^\d{2}:\d{2}$/.test(time)) {
      onToast('ساعت را وارد کنید')
      return
    }
    punchOn(key, type, time)
    onToast(type === 'in' ? `ورود ${faDigits(time)} ثبت شد` : `خروج ${faDigits(time)} ثبت شد`)
    setStep('choose')
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="grabber" />
        <div className="sheet-head">
          <div>
            <div className="sheet-title">{dateLabel}</div>
            <div className="sheet-sub num">
              شیفت {faDigits(settings.shiftStart)} تا {faDigits(settings.shiftEnd)}
              {overnight ? ' روز بعد' : ''} · {live.isWeekend ? 'روز تعطیل' : 'روز کاری'}
            </div>
          </div>
          <div className="spacer" />
          <button className="icon-btn" onClick={onClose} aria-label="بستن">
            <Icon name="x" size={18} />
          </button>
        </div>

        {step === 'choose' && (
          <>
            <div className="ask-title">چه چیزی برای این روز ثبت می‌کنی؟</div>
            <div className="ask-grid">
              <button className="ask-card in" onClick={() => startFlow('in')}>
                <span className="ask-icon">
                  <Icon name="login" size={26} />
                </span>
                <span className="ask-label">ثبت ورود</span>
                <span className="ask-hint">ساعت شروع کار</span>
              </button>
              <button className="ask-card out" onClick={() => startFlow('out')}>
                <span className="ask-icon">
                  <Icon name="logout" size={26} />
                </span>
                <span className="ask-label">ثبت خروج</span>
                <span className="ask-hint">ساعت پایان کار</span>
              </button>
            </div>

            <div className="ask-links">
              <button className="btn btn-sm" onClick={() => setStep('edit')}>
                <Icon name="list" size={14} /> ویرایش کامل روز (چند بازه، مرخصی، توضیح)
              </button>
            </div>

            <div className="sheet-punches">
              <div className="section-title" style={{ marginBottom: 6 }}>
                <Icon name="clock" size={14} /> ثبت‌های این روز
              </div>
              {live.punches.length === 0 ? (
                <div className="tiny muted">چیزی ثبت نشده است.</div>
              ) : (
                live.punches.map((p, i) => (
                  <div className="kv" key={i}>
                    <span className="kv-k">
                      {p.type === 'in' ? 'ورود' : 'خروج'}
                      {new Date(p.at).getDate() !== parseDayKey(key).getDate() ? ' (بامداد روز بعد)' : ''}
                    </span>
                    <span className={`kv-v num ${p.type === 'in' ? 'c-teal' : 'c-red'}`}>
                      {faDigits(clockOf(p.at))}
                    </span>
                  </div>
                ))
              )}
              <div className="kv">
                <span className="kv-k">کارکرد این روز</span>
                <span className="kv-v c-green">{formatDuration(live.workedMinutes)}</span>
              </div>
            </div>
          </>
        )}

        {step === 'time' && (
          <>
            <div className="ask-title">
              {type === 'in' ? 'ساعت ورود را وارد کن' : 'ساعت خروج را وارد کن'}
            </div>
            <div className="time-big">
              <input
                className="time-input num"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                autoFocus
              />
            </div>
            <div className="time-chips">
              <button
                className="btn btn-sm"
                onClick={() => {
                  const now = new Date()
                  setTime(`${pad2(now.getHours())}:${pad2(now.getMinutes())}`)
                }}
              >
                الان
              </button>
              <button className="btn btn-sm" onClick={() => setTime(settings.shiftStart)}>
                شروع شیفت {faDigits(settings.shiftStart)}
              </button>
              <button className="btn btn-sm" onClick={() => setTime(minutesToTime(endRaw))}>
                پایان شیفت {faDigits(minutesToTime(endRaw))}
              </button>
            </div>
            {overnight && time <= minutesToTime(endRaw) && (
              <div className="notice" style={{ marginTop: 12 }}>
                <Icon name="info" size={16} />
                <div>
                  چون ساعت انتخابی در بامداد است، به‌عنوان ادامه شیفت همین روز (بامداد روز بعد) ثبت
                  می‌شود و در روز بعد جدا حساب نمی‌شود.
                </div>
              </div>
            )}

            <div className="sheet-actions">
              <button className="btn btn-primary" onClick={save}>
                <Icon name="check" size={16} /> ثبت {type === 'in' ? 'ورود' : 'خروج'}
              </button>
              <button className="btn" onClick={() => setStep('choose')}>
                بازگشت
              </button>
            </div>
          </>
        )}

        {step === 'edit' && (
          <>
            <div className="row2" style={{ marginBottom: 14 }}>
              <div className="pill pill-green num" style={{ padding: '9px 10px', fontSize: 12 }}>
                کارکرد {formatDuration(live.workedMinutes)}
              </div>
              <div className="pill pill-violet num" style={{ padding: '9px 10px', fontSize: 12 }}>
                اضافه‌کاری {formatDuration(live.overtimeMinutes)}
              </div>
            </div>
            <DayEditor
              key={key}
              dateISO={key}
              record={records[key]}
              onDone={(msg) => {
                onToast(msg)
                setStep('choose')
              }}
              weekendDays={settings.weekendDays}
            />
            <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => setStep('choose')}>
              بازگشت
            </button>
          </>
        )}
      </div>
    </div>
  )
}
