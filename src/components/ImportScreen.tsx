import { useCallback, useMemo, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import type { ImportMode } from '../lib/store'
import { FileFetchError, fetchFileBuffer } from '../lib/fileFetch'
import {
  buildRows,
  guessMapping,
  NO_COLUMN,
  readWorkbook,
  rowsToDayRecords,
  type ColumnKey,
  type ColumnMapping,
  type SheetData,
} from '../lib/importer'
import {
  faDigits,
  formatDuration,
  pad2,
  parseDayKey,
  persianWeekday,
  PERSIAN_WEEKDAYS,
  toJalali,
} from '../lib/jalali'
import { Icon } from './Icons'

type Source = 'link' | 'file'

const COLUMN_LABELS: { key: ColumnKey; label: string; hint: string }[] = [
  { key: 'date', label: 'تاریخ', hint: 'الزامی' },
  { key: 'in', label: 'ورود', hint: '۰۸:۰۵' },
  { key: 'out', label: 'خروج', hint: '۱۶:۳۰' },
  { key: 'in2', label: 'ورود دوم', hint: 'اختیاری' },
  { key: 'out2', label: 'خروج دوم', hint: 'اختیاری' },
  { key: 'worked', label: 'کارکرد', hint: 'اختیاری' },
  { key: 'leave', label: 'مرخصی', hint: 'دقیقه/ساعت' },
  { key: 'overtime', label: 'اضافه‌کاری', hint: 'دقیقه/ساعت' },
  { key: 'note', label: 'توضیح', hint: 'اختیاری' },
]

const jdate = (day: string) => {
  const j = toJalali(parseDayKey(day))
  return faDigits(`${j.jy}/${pad2(j.jm)}/${pad2(j.jd)}`)
}

const workedLabel = (row: { in?: string; out?: string; workedMinutes?: number }) => {
  if (row.workedMinutes) return formatDuration(row.workedMinutes)
  if (!row.in || !row.out) return '—'
  const [ih, im] = row.in.split(':').map(Number)
  const [oh, om] = row.out.split(':').map(Number)
  let diff = oh * 60 + om - (ih * 60 + im)
  if (diff < 0) diff += 1440
  return formatDuration(diff)
}

export function ImportScreen({ onToast }: { onToast: (msg: string) => void }) {
  const { settings, importRecords } = useStore()
  const [source, setSource] = useState<Source>('link')
  const [url, setUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [sheets, setSheets] = useState<SheetData[]>([])
  const [sheetIndex, setSheetIndex] = useState(0)
  const [mapping, setMapping] = useState<ColumnMapping | null>(null)
  const [mode, setMode] = useState<ImportMode>('replace')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const fileInput = useRef<HTMLInputElement | null>(null)

  const rows = sheets[sheetIndex]?.rows ?? []
  const headers = mapping ? (rows[mapping.headerRow] ?? []) : []

  const parsed = useMemo(() => {
    if (!mapping || !rows.length) return { parsed: [], invalid: 0 }
    return buildRows(rows, mapping)
  }, [mapping, rows])

  const usable = parsed.parsed.filter((row) => row.ok)
  const leaveCount = usable.filter((row) => (row.leaveMinutes ?? 0) > 0).length
  const overtimeCount = usable.filter((row) => (row.overtimeMinutes ?? 0) > 0).length

  const applyWorkbook = useCallback((book: SheetData[], name: string) => {
    if (!book.length || !book.some((sheet) => sheet.rows.length)) {
      throw new Error('فایل خالی است یا شیت قابل خواندن ندارد.')
    }
    setSheets(book)
    setFileName(name)
    setSheetIndex(0)
    setMapping(guessMapping(book[0].rows))
    setResult('')
    setError('')
  }, [])

  const fromUrl = async () => {
    if (busy) return
    if (!url.trim()) {
      setError('لینک فایل اکسل را وارد کنید.')
      return
    }
    setBusy(true)
    setError('')
    setResult('')
    try {
      const buffer = await fetchFileBuffer(url)
      const book = await readWorkbook(buffer)
      applyWorkbook(book, url.trim().split('/').pop()?.split('?')[0] || 'فایل لینک')
    } catch (err) {
      setError(err instanceof FileFetchError || err instanceof Error ? err.message : 'خطا در خواندن فایل')
    } finally {
      setBusy(false)
    }
  }

  const fromFile = async (file: File | undefined) => {
    if (!file || busy) return
    setBusy(true)
    setError('')
    setResult('')
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error('حجم فایل بیشتر از ۱۵ مگابایت است.')
      const buffer = await file.arrayBuffer()
      const book = await readWorkbook(buffer)
      applyWorkbook(book, file.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در خواندن فایل')
    } finally {
      setBusy(false)
    }
  }

  const changeSheet = (index: number) => {
    setSheetIndex(index)
    setMapping(guessMapping(sheets[index]?.rows ?? []))
    setResult('')
  }

  const setColumn = (key: ColumnKey, value: number) => {
    setMapping((current) => (current ? { ...current, [key]: value } : current))
    setResult('')
  }

  const runImport = async () => {
    if (!usable.length) {
      setError('ردیف قابل ثبتی پیدا نشد. ستون‌ها را بررسی کنید.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const records = rowsToDayRecords(usable, settings)
      const count = await importRecords(records, mode)
      setResult(`${faDigits(count)} روز با موفقیت ثبت شد.`)
      onToast('ایمپورت انجام شد')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ایمپورت انجام نشد')
    } finally {
      setBusy(false)
    }
  }

  const columnOptions = headers.map((header, index) => ({
    value: index,
    label: `${faDigits(index + 1)}. ${header || 'بدون عنوان'}`,
  }))

  return (
    <div className="report-grid">
      <section className="card">
        <div className="card-head">
          <div className="card-title">ایمپورت از اکسل</div>
          <div className="spacer" />
          <span className="chip chip-blue">لینک یا فایل</span>
        </div>
        <div className="card-body">
          <div className="segmented" style={{ marginBottom: 12 }}>
            <button
              className={`seg-btn ${source === 'link' ? 'active' : ''}`}
              onClick={() => setSource('link')}
            >
              از لینک
            </button>
            <button
              className={`seg-btn ${source === 'file' ? 'active' : ''}`}
              onClick={() => setSource('file')}
            >
              از فایل
            </button>
          </div>

          {source === 'link' ? (
            <>
              <div className="field">
                <label htmlFor="import-url">لینک فایل اکسل (xlsx / csv)</label>
                <input
                  id="import-url"
                  className="input"
                  dir="ltr"
                  inputMode="url"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" onClick={() => void fromUrl()} disabled={busy}>
                <Icon name="download" size={16} /> {busy ? 'در حال دریافت…' : 'دریافت و خواندن فایل'}
              </button>
              <p className="tiny muted" style={{ marginBottom: 0 }}>
                لینک گوگل‌شیت، گوگل‌درایو و دراپ‌باکس پشتیبانی می‌شود. فایل باید برای «هر کسی که لینک
                را دارد» قابل مشاهده باشد.
              </p>
            </>
          ) : (
            <>
              <input
                ref={fileInput}
                type="file"
                accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                style={{ display: 'none' }}
                onChange={(e) => void fromFile(e.target.files?.[0])}
              />
              <button
                className="btn btn-primary"
                onClick={() => fileInput.current?.click()}
                disabled={busy}
                style={{ width: '100%', justifyContent: 'center', padding: 13 }}
              >
                <Icon name="download" size={16} /> {busy ? 'در حال خواندن…' : 'انتخاب فایل اکسل از گوشی'}
              </button>
              <p className="tiny muted" style={{ marginBottom: 0 }}>
                فایل خروجی اکسل همین اپ، فایل‌های اکسل دستگاه حضور و غیاب یا هر جدولی با ستون تاریخ و
                ساعت ورود/خروج.
              </p>
            </>
          )}

          {error && (
            <div className="auth-alert error" style={{ marginTop: 12 }}>
              <Icon name="info" size={16} />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="auth-alert ok" style={{ marginTop: 12 }}>
              <Icon name="check" size={16} />
              <span>{result}</span>
            </div>
          )}
        </div>
      </section>

      {sheets.length > 0 && mapping && (
        <>
          <section className="card">
            <div className="card-head">
              <div className="card-title">تطبیق ستون‌ها</div>
              <div className="spacer" />
              <span className="chip chip-gray num">{fileName}</span>
            </div>
            <div className="card-body">
              {sheets.length > 1 && (
                <div className="field">
                  <label htmlFor="sheet-select">شیت</label>
                  <select
                    id="sheet-select"
                    className="select"
                    value={sheetIndex}
                    onChange={(e) => changeSheet(Number(e.target.value))}
                  >
                    {sheets.map((sheet, index) => (
                      <option key={sheet.name} value={index}>
                        {sheet.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="row2">
                {COLUMN_LABELS.map((column) => (
                  <div className="field" key={column.key}>
                    <label htmlFor={`col-${column.key}`}>
                      {column.label} <span className="tiny muted">({column.hint})</span>
                    </label>
                    <select
                      id={`col-${column.key}`}
                      className="select"
                      value={mapping[column.key]}
                      onChange={(e) => setColumn(column.key, Number(e.target.value))}
                    >
                      <option value={NO_COLUMN}>— بدون ستون —</option>
                      {columnOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="kv">
                <span className="kv-k">ردیف‌های قابل ثبت</span>
                <span className="kv-v num">{faDigits(usable.length)}</span>
              </div>
              <div className="kv">
                <span className="kv-k">ردیف‌های نامعتبر / عنوان</span>
                <span className="kv-v num">{faDigits(parsed.invalid)}</span>
              </div>
              <div className="kv">
                <span className="kv-k">ردیف‌های دارای مرخصی / اضافه‌کاری</span>
                <span className="kv-v num">
                  {faDigits(leaveCount)} / {faDigits(overtimeCount)}
                </span>
              </div>

              <div className="field">
                <label>اگر روزی از قبل ثبت شده باشد</label>
                <div className="segmented">
                  <button
                    className={`seg-btn ${mode === 'replace' ? 'active' : ''}`}
                    onClick={() => setMode('replace')}
                  >
                    جایگزین شود
                  </button>
                  <button
                    className={`seg-btn ${mode === 'merge' ? 'active' : ''}`}
                    onClick={() => setMode('merge')}
                  >
                    ادغام شود
                  </button>
                  <button
                    className={`seg-btn ${mode === 'skip' ? 'active' : ''}`}
                    onClick={() => setMode('skip')}
                  >
                    رد شود
                  </button>
                </div>
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: 13 }}
                onClick={() => void runImport()}
                disabled={busy || usable.length === 0}
              >
                <Icon name="check" size={16} /> ثبت{' '}
                <span className="num">{faDigits(usable.length)}</span> روز در اپ
              </button>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div className="card-title">پیش‌نمایش</div>
              <div className="spacer" />
              <span className="chip chip-gray">۱۰ ردیف اول</span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>تاریخ</th>
                      <th>روز</th>
                      <th>ورود</th>
                      <th>خروج</th>
                      <th>ورود ۲</th>
                      <th>خروج ۲</th>
                      <th>کارکرد</th>
                      <th>مرخصی</th>
                      <th>اضافه‌کاری</th>
                      <th>وضعیت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.parsed.slice(0, 10).map((row, index) => (
                      <tr key={`${row.day}-${index}`} style={{ opacity: row.ok ? 1 : 0.5 }}>
                        <td className="num">{row.day ? jdate(row.day) : '—'}</td>
                        <td className="tiny">
                          {row.day ? PERSIAN_WEEKDAYS[persianWeekday(parseDayKey(row.day))] : '—'}
                        </td>
                        <td className="num">{row.in ? faDigits(row.in) : '—'}</td>
                        <td className="num">{row.out ? faDigits(row.out) : '—'}</td>
                        <td className="num">{row.in2 ? faDigits(row.in2) : '—'}</td>
                        <td className="num">{row.out2 ? faDigits(row.out2) : '—'}</td>
                        <td className="num">{workedLabel(row)}</td>
                        <td className="num">
                          {row.leaveMinutes ? formatDuration(row.leaveMinutes) : '—'}
                        </td>
                        <td className="num">
                          {row.overtimeMinutes ? formatDuration(row.overtimeMinutes) : '—'}
                        </td>
                        <td className="tiny">
                          {row.ok ? (
                            <span className="chip chip-green">آماده ثبت</span>
                          ) : (
                            <span className="chip chip-red">{row.error}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {parsed.parsed.length === 0 && (
                      <tr>
                        <td colSpan={10}>
                          <div className="empty-state">در این شیت ردیف قابل خواندنی پیدا نشد.</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}

      <section className="card">
        <div className="card-head">
          <div className="card-title">راهنما</div>
        </div>
        <div className="card-body">
          <div className="kv">
            <span className="kv-k">ساختار پیشنهادی</span>
            <span className="kv-v tiny">
              تاریخ · ورود · خروج · ورود دوم · خروج دوم · کارکرد · مرخصی · اضافه‌کاری · توضیح
            </span>
          </div>
          <div className="kv">
            <span className="kv-k">قالب تاریخ</span>
            <span className="kv-v tiny num">۱۴۰۴/۰۸/۱۸ یا 2025-11-09</span>
          </div>
          <div className="kv">
            <span className="kv-k">قالب ساعت</span>
            <span className="kv-v tiny num">۰۸:۰۵ یا 8:05 یا ۱۶:۳۰</span>
          </div>
          <div className="kv">
            <span className="kv-k">شیفت شبانه</span>
            <span className="kv-v tiny">
              خروج ۰۴:۰۰ بامداد به‌صورت خودکار برای روز شروع شیفت حساب می‌شود.
            </span>
          </div>
          {settings.fullName && (
            <div className="kv">
              <span className="kv-k">ثبت برای</span>
              <span className="kv-v tiny">{settings.fullName}</span>
            </div>
          )}

          <div className="notice" style={{ marginTop: 10 }}>
            <Icon name="info" size={16} />
            <div>
              بهترین قالب همان فایل «خروجی اکسل» خود اپ است؛ اگر ستون‌ها متفاوت باشد بعد از خواندن
              فایل می‌توانید ستون‌ها را دستی تطبیق دهید.
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
