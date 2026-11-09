import { useEffect, useState } from 'react'
import {
  APP_VERSION,
  RELEASES_URL,
  checkForUpdate,
  isNativeApp,
  openExternal,
  type ReleaseInfo,
} from '../lib/updates'
import { applyPwaUpdate, checkServiceWorkerUpdate, onPwaUpdateState } from '../lib/pwa'
import { Icon } from './Icons'

type State = 'idle' | 'checking' | 'latest' | 'available' | 'offline'

export function UpdateCard({ onToast }: { onToast: (msg: string) => void }) {
  const [state, setState] = useState<State>('idle')
  const [release, setRelease] = useState<ReleaseInfo | null>(null)
  const [swReady, setSwReady] = useState(false)
  const native = isNativeApp()

  useEffect(() => onPwaUpdateState(setSwReady), [])

  const check = async () => {
    setState('checking')
    const swPending = await checkServiceWorkerUpdate()
    const result = await checkForUpdate()
    if (result.hasUpdate) {
      setRelease(result.latest)
      setState('available')
      return
    }
    if (swPending) {
      setSwReady(true)
      setState('available')
      return
    }
    setRelease(result.latest)
    setState(result.error === 'no-release' ? 'offline' : 'latest')
    onToast('نسخه اپ به‌روز است')
  }

  const downloadUrl = release?.apkUrl ?? release?.pageUrl ?? RELEASES_URL

  return (
    <section className="card">
      <div className="card-head">
        <div className="card-title">به‌روزرسانی اپ</div>
        <div className="spacer" />
        <span className="chip chip-gray num">نسخه {APP_VERSION}</span>
      </div>
      <div className="card-body">
        <div className="kv">
          <span className="kv-k">نوع نصب</span>
          <span className="kv-v">{native ? 'اپ اندروید / آیفون' : 'نسخه وب (PWA)'}</span>
        </div>
        <div className="kv">
          <span className="kv-k">آخرین نسخه منتشرشده</span>
          <span className="kv-v num">{release ? `v${release.version}` : 'بررسی نشده'}</span>
        </div>

        {state === 'available' && (
          <div className="notice" style={{ marginTop: 10 }}>
            <Icon name="download" size={16} />
            <div>
              {release && release.version !== APP_VERSION
                ? `نسخه ${release.version} آماده است.`
                : 'نسخه جدید همین حالا آماده نصب است.'}{' '}
              برای دریافت، دکمه زیر را بزن.
            </div>
          </div>
        )}
        {state === 'latest' && (
          <div className="notice" style={{ marginTop: 10 }}>
            <Icon name="check" size={16} />
            <div>نسخه {APP_VERSION} آخرین نسخه است؛ چیزی برای به‌روزرسانی نیست.</div>
          </div>
        )}
        {state === 'offline' && (
          <div className="notice warn" style={{ marginTop: 10 }}>
            <Icon name="info" size={16} />
            <div>دسترسی به سرور نسخه‌ها نبود (اینترنت یا هنوز نسخه‌ای منتشر نشده).</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button className="btn" onClick={check} disabled={state === 'checking'}>
            <Icon name="download" size={15} />
            {state === 'checking' ? 'در حال بررسی…' : 'بررسی بروزرسانی'}
          </button>

          {swReady && (
            <button
              className="btn btn-primary"
              onClick={async () => {
                onToast('در حال به‌روزرسانی…')
                await applyPwaUpdate()
              }}
            >
              <Icon name="check" size={15} /> نصب فوری نسخه جدید
            </button>
          )}

          {state === 'available' && (
            <button
              className="btn btn-primary"
              onClick={() => {
                if (native && release?.apkUrl) openExternal(release.apkUrl)
                else openExternal(downloadUrl)
              }}
            >
              <Icon name="download" size={15} /> دریافت نسخه جدید
            </button>
          )}

          <a className="btn" href={RELEASES_URL} target="_blank" rel="noreferrer">
            تاریخچه نسخه‌ها
          </a>
        </div>

        <p className="tiny muted" style={{ marginBottom: 0, marginTop: 12 }}>
          {native
            ? 'در نسخه اندروید، با دریافت فایل APK نسخه جدید را روی همین اپ نصب کن؛ اطلاعات و ثبت‌هایت حفظ می‌شود.'
            : 'نسخه وب خودش هر ۳۰ دقیقه سراغ نسخه تازه می‌رود؛ هر وقت نسخه جدیدی منتشر شود، پیام «بروزرسانی» بالای صفحه می‌آید.'}
        </p>
      </div>
    </section>
  )
}
