import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase'
import { normalizeImportUrl } from './importer'

export class FileFetchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FileFetchError'
  }
}

const MAX_BYTES = 15 * 1024 * 1024

function looksLikeHtml(buffer: ArrayBuffer): boolean {
  const head = new Uint8Array(buffer.slice(0, 64))
  let text = ''
  for (const byte of head) text += String.fromCharCode(byte)
  return /^\s*<(!doctype|html|head|body)/i.test(text)
}

async function toBuffer(response: Response): Promise<ArrayBuffer> {
  const type = (response.headers.get('content-type') || '').toLowerCase()
  const length = Number(response.headers.get('content-length') || 0)
  if (length > MAX_BYTES) throw new FileFetchError('حجم فایل بیشتر از ۱۵ مگابایت است.')
  const buffer = await response.arrayBuffer()
  if (buffer.byteLength > MAX_BYTES) throw new FileFetchError('حجم فایل بیشتر از ۱۵ مگابایت است.')
  if (buffer.byteLength === 0) throw new FileFetchError('فایل خالی است.')
  if (type.includes('application/json')) {
    let message = 'پاسخ سرور فایل نبود.'
    try {
      const parsed = JSON.parse(new TextDecoder().decode(buffer)) as { error?: string }
      if (parsed?.error) message = parsed.error
    } catch {
      /* ignore */
    }
    throw new FileFetchError(message)
  }
  if (type.includes('text/html') || looksLikeHtml(buffer)) {
    throw new FileFetchError(
      'این لینک فایل اکسل برنمی‌گرداند (صفحه وب است). دسترسی لینک را روی «هر کسی که لینک را دارد» بگذارید یا فایل را دانلود و آپلود کنید.',
    )
  }
  return buffer
}

/**
 * فایل اکسل را از یک لینک می‌گیرد.
 * اول مستقیم (برای سرورهایی که CORS دارند) و بعد از طریق تابع ابری خودمان.
 */
export async function fetchFileBuffer(rawUrl: string): Promise<ArrayBuffer> {
  const url = normalizeImportUrl(rawUrl)
  if (!/^https?:\/\//i.test(url)) {
    throw new FileFetchError('لینک باید با http یا https شروع شود.')
  }

  let directError: unknown = null
  try {
    const response = await fetch(url, { redirect: 'follow', mode: 'cors' })
    if (response.ok) return await toBuffer(response)
    directError = new FileFetchError(`سرور مقصد با کد ${response.status} پاسخ داد.`)
  } catch (error) {
    directError = error
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/fetch-file?url=${encodeURIComponent(url)}`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      },
    )
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new FileFetchError(
        detail?.slice(0, 200) || 'دریافت فایل از این لینک ممکن نشد. فایل را دانلود و آپلود کنید.',
      )
    }
    return await toBuffer(response)
  } catch (error) {
    if (error instanceof FileFetchError) throw error
    const message =
      directError instanceof FileFetchError
        ? directError.message
        : 'دریافت فایل از این لینک ممکن نشد. لینک را بررسی کنید یا فایل را دانلود و آپلود کنید.'
    throw new FileFetchError(message)
  }
}
