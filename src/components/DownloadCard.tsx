import { useEffect, useState } from 'react'
import { APP_VERSION, openExternal } from '../lib/updates'
import { Icon } from './Icons'

interface Mirror {
  label: string
  url: string
}

const PAGES_APK = 'https://mazodimobinhost-creator.github.io/hozor/dl/hozor.apk'

function defaultMirrors(version: string): Mirror[] {
  return [
    { label: 'GitHub Pages (پیشنهادی)', url: PAGES_APK },
    {
      label: 'GitHub Release',
      url: `https://github.com/mazodimobinhost-creator/hozor/releases/download/v${version}/hozor-${version}.apk`,
    },
  ]
}

export function DownloadCard({ onToast }: { onToast: (msg: string) => void }) {
  const [mirrors, setMirrors] = useState<Mirror[]>(() => defaultMirrors(APP_VERSION))
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}dl/mirrors.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { mirrors?: Mirror[] } | null) => {
        if (data?.mirrors?.length) setMirrors(data.mirrors)
      })
      .catch(() => {
        /* آینه‌ها در دسترس نیستند؛ لیست پیش‌فرض می‌ماند */
      })
  }, [])

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      onToast('لینک کپی شد')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      onToast('کپی نشد؛ لینک را دستی انتخاب کن')
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <div className="card-title">دانلود اپ اندروید</div>
        <div className="spacer" />
        <span className="chip chip-gray num">v{APP_VERSION}</span>
      </div>
      <div className="card-body">
        <p className="tiny muted" style={{ marginTop: 0 }}>
          اگر دانلود از یک مسیر نصفه ماند، از مسیرهای دیگر امتحان کن. فایل روی این مسیرها یکی است.
        </p>

        <div className="mirror-list">
          {mirrors.map((m) => (
            <div className="mirror-row" key={m.url}>
              <a
                className="mirror-main"
                href={m.url}
                onClick={(e) => {
                  e.preventDefault()
                  void openExternal(m.url)
                }}
              >
                <span className="mirror-icon">
                  <Icon name="download" size={16} />
                </span>
                <span className="mirror-label">{m.label}</span>
                <Icon name="chevronLeft" size={15} />
              </a>
              <button
                className="icon-btn"
                onClick={() => void copy(m.url)}
                aria-label="کپی لینک"
                title="کپی لینک"
              >
                <Icon name={copied ? 'check' : 'list'} size={15} />
              </button>
            </div>
          ))}
        </div>

        <div className="notice" style={{ marginTop: 12 }}>
          <Icon name="info" size={16} />
          <div>
            <b>اندروید:</b> فایل APK را دانلود کن و در پیام «نصب از منابع ناشناس» اجازه بده. اگر نسخه
            قبلی نصب است، همین فایل روی آن به‌روزرسانی می‌شود و ثبت‌ها می‌مانند.
            <br />
            <b>آیفون:</b> APK نصب نمی‌شود؛ لینک <span className="num">…github.io/hozor</span> را در
            Safari باز کن و «Add to Home Screen» بزن.
          </div>
        </div>
      </div>
    </section>
  )
}
