export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0'

export const GITHUB_REPO = 'mazodimobinhost-creator/hozor'
export const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`

export interface ReleaseInfo {
  version: string
  tag: string
  name: string
  notes: string
  publishedAt: string
  pageUrl: string
  apkUrl?: string
}

export function compareVersions(a: string, b: string): number {
  const clean = (v: string) => v.replace(/^v/i, '').split(/[.+-]/).map((n) => parseInt(n, 10) || 0)
  const pa = clean(a)
  const pb = clean(b)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x > y) return 1
    if (x < y) return -1
  }
  return 0
}

export function isNativeApp(): boolean {
  return typeof window !== 'undefined' && Boolean(window.Capacitor?.isNativePlatform?.())
}

export async function fetchLatestRelease(): Promise<ReleaseInfo | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      tag_name?: string
      name?: string
      body?: string
      html_url?: string
      published_at?: string
      assets?: { name?: string; browser_download_url?: string }[]
    }
    const tag = data.tag_name ?? ''
    const apk = data.assets?.find((a) => (a.name ?? '').toLowerCase().endsWith('.apk'))
    return {
      version: tag.replace(/^v/i, ''),
      tag,
      name: data.name ?? tag,
      notes: data.body ?? '',
      publishedAt: data.published_at ?? '',
      pageUrl: data.html_url ?? RELEASES_URL,
      apkUrl: apk?.browser_download_url,
    }
  } catch {
    return null
  }
}

export interface UpdateCheck {
  current: string
  latest: ReleaseInfo | null
  hasUpdate: boolean
  error?: string
}

export async function checkForUpdate(): Promise<UpdateCheck> {
  const latest = await fetchLatestRelease()
  if (!latest) {
    return { current: APP_VERSION, latest: null, hasUpdate: false, error: 'no-release' }
  }
  return {
    current: APP_VERSION,
    latest,
    hasUpdate: compareVersions(latest.version, APP_VERSION) > 0,
  }
}

export function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}
