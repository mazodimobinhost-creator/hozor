import { useState } from 'react'
import { authErrorMessage, useAuth } from '../lib/auth'
import { Icon } from './Icons'
import { faDigits } from '../lib/jalali'

type Mode = 'signin' | 'signup' | 'reset'

export function AuthScreen() {
  const { signIn, signUp, resetPassword } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [unit, setUnit] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const switchMode = (next: Mode) => {
    setMode(next)
    setError('')
    setInfo('')
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    setError('')
    setInfo('')

    if (!email.trim()) {
      setError('ایمیل را وارد کنید.')
      return
    }
    if (mode !== 'reset' && password.length < 6) {
      setError('رمز عبور باید حداقل ۶ کاراکتر باشد.')
      return
    }
    if (mode === 'signup' && !fullName.trim()) {
      setError('نام و نام خانوادگی را وارد کنید.')
      return
    }

    setBusy(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
      } else if (mode === 'signup') {
        const result = await signUp({ email, password, fullName, unit })
        if (result.needsConfirmation) {
          setInfo('حساب ساخته شد. برای فعال‌سازی، ایمیل خود را تأیید کنید.')
        }
      } else {
        await resetPassword(email)
        setInfo('لینک بازیابی رمز به ایمیل شما فرستاده شد.')
      }
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-mark">
            <Icon name="calendarCheck" size={26} />
          </div>
          <div>
            <div className="auth-title">حضور و غیاب من</div>
            <div className="auth-sub">ثبت ورود و خروج، تقویم شمسی و کارکرد ماهانه</div>
          </div>
        </div>

        {mode !== 'reset' && (
          <div className="segmented auth-seg">
            <button
              type="button"
              className={`seg-btn ${mode === 'signin' ? 'active' : ''}`}
              onClick={() => switchMode('signin')}
            >
              ورود
            </button>
            <button
              type="button"
              className={`seg-btn ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => switchMode('signup')}
            >
              ثبت‌نام
            </button>
          </div>
        )}

        <form onSubmit={submit} noValidate>
          {mode === 'signup' && (
            <>
              <div className="field">
                <label htmlFor="auth-name">نام و نام خانوادگی</label>
                <input
                  id="auth-name"
                  className="input"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثلاً سارا محمدی"
                />
              </div>
              <div className="field">
                <label htmlFor="auth-unit">واحد سازمانی (اختیاری)</label>
                <input
                  id="auth-unit"
                  className="input"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="مثلاً واحد فنی"
                />
              </div>
            </>
          )}

          <div className="field">
            <label htmlFor="auth-email">ایمیل</label>
            <input
              id="auth-email"
              className="input auth-ltr"
              type="email"
              inputMode="email"
              autoComplete="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>

          {mode !== 'reset' && (
            <div className="field">
              <label htmlFor="auth-pass">رمز عبور</label>
              <div className="auth-pass">
                <input
                  id="auth-pass"
                  className="input auth-ltr"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="حداقل ۶ کاراکتر"
                />
                <button
                  type="button"
                  className="auth-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'پنهان کردن رمز' : 'نمایش رمز'}
                >
                  {showPassword ? 'پنهان' : 'نمایش'}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="auth-alert error">
              <Icon name="info" size={16} />
              <span>{error}</span>
            </div>
          )}

          {info && (
            <div className="auth-alert ok">
              <Icon name="check" size={16} />
              <span>{info}</span>
            </div>
          )}

          <button
            className="btn btn-primary auth-submit"
            type="submit"
            disabled={busy}
            style={{ width: '100%', justifyContent: 'center', padding: 13 }}
          >
            {busy
              ? 'لطفاً صبر کنید…'
              : mode === 'signin'
                ? 'ورود به حساب'
                : mode === 'signup'
                  ? 'ساخت حساب'
                  : 'ارسال لینک بازیابی'}
          </button>
        </form>

        <div className="auth-links">
          {mode === 'signin' && (
            <button type="button" className="link-btn" onClick={() => switchMode('reset')}>
              رمز عبور را فراموش کرده‌ام
            </button>
          )}
          {mode === 'reset' && (
            <button type="button" className="link-btn" onClick={() => switchMode('signin')}>
              بازگشت به ورود
            </button>
          )}
        </div>

        <div className="auth-note">
          <Icon name="userCircle" size={15} />
          <span>
            هر حساب فقط سوابق خودش را می‌بیند. اطلاعات شما روی سرور امن ذخیره و بین گوشی و مرورگر
            هم‌سان می‌شود.
          </span>
        </div>

        <div className="auth-foot tiny muted num">
          نسخه {faDigits(__APP_VERSION__)} · شیفت پیش‌فرض ۰۸:۰۰ تا ۰۴:۰۰
        </div>
      </div>
    </div>
  )
}
