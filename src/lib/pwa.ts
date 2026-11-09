import { registerSW } from 'virtual:pwa-register'

type Updater = (reloadPage?: boolean) => Promise<void>

let updater: Updater | null = null
let listeners: ((needRefresh: boolean) => void)[] = []
let pendingRefresh = false
let initialized = false

export function onPwaUpdateState(cb: (needRefresh: boolean) => void): () => void {
  listeners.push(cb)
  cb(pendingRefresh)
  return () => {
    listeners = listeners.filter((l) => l !== cb)
  }
}

function emit(value: boolean) {
  pendingRefresh = value
  listeners.forEach((l) => l(value))
}

export function initPwa() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  if (!('serviceWorker' in navigator)) return

  updater = registerSW({
    immediate: true,
    onNeedRefresh() {
      emit(true)
    },
    onOfflineReady() {
      /* آفلاین آماده است */
    },
  })

  // هر ۳۰ دقیقه یک‌بار سراغ نسخه تازه می‌رویم
  window.setInterval(async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      await reg?.update()
    } catch {
      /* ignore */
    }
  }, 30 * 60 * 1000)
}

export async function applyPwaUpdate(): Promise<boolean> {
  if (!updater) {
    window.location.reload()
    return false
  }
  await updater(true)
  return true
}

/** دستی دنبال نسخه جدید بگرد (برای دکمه «بررسی بروزرسانی») */
export async function checkServiceWorkerUpdate(): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return false
    await reg.update()
    return Boolean(reg.waiting || reg.installing)
  } catch {
    return false
  }
}
