import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/vazirmatn/400.css'
import '@fontsource/vazirmatn/500.css'
import '@fontsource/vazirmatn/600.css'
import '@fontsource/vazirmatn/700.css'
import '@fontsource/vazirmatn/800.css'
import './styles.css'
import App from './App'
import { initPwa } from './lib/pwa'
import { isNativeApp } from './lib/updates'

declare global {
  interface Window {
    __HOZOR_READY__?: boolean
  }
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('hozor crash', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="boot">
        <div className="boot-mark">!</div>
        <div className="boot-text" style={{ maxWidth: 380, textAlign: 'center', lineHeight: 2 }}>
          برنامه با خطا متوقف شد. صفحه را ببندید و دوباره باز کنید.
          <br />
          <span className="tiny" dir="ltr">
            {this.state.error.message}
          </span>
          <br />
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => location.reload()}>
            بازخوانی برنامه
          </button>
        </div>
      </div>
    )
  }
}

// سرویس‌ورکر درون وب‌ویو اپ اندروید/آیفون می‌تواند باعث دیدن نسخه قدیمی شود
if (!isNativeApp()) initPwa()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

window.__HOZOR_READY__ = true
document.getElementById('boot')?.remove()
