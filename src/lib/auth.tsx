import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabase } from './supabase'

export interface SignUpInput {
  email: string
  password: string
  fullName: string
  unit?: string
  org?: string
}

export interface AuthValue {
  session: Session | null
  loading: boolean
  /** ایمیل کاربر وارد شده */
  email: string
  signIn: (email: string, password: string) => Promise<void>
  signUp: (input: SignUpInput) => Promise<{ needsConfirmation: boolean }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

/** پیام‌های خطای Supabase را به فارسی برمی‌گرداند */
export function authErrorMessage(error: unknown): string {
  const raw =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : String(error ?? '')
  const msg = raw.toLowerCase()

  if (!msg) return 'خطای نامشخصی رخ داد. دوباره تلاش کنید.'
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed'))
    return 'اتصال به سرور برقرار نشد. اینترنت را بررسی کنید.'
  if (msg.includes('invalid login credentials')) return 'ایمیل یا رمز عبور درست نیست.'
  if (msg.includes('email not confirmed'))
    return 'ایمیل شما هنوز تأیید نشده است. صندوق ایمیل را بررسی کنید.'
  if (msg.includes('user already registered') || msg.includes('already been registered'))
    return 'این ایمیل قبلاً ثبت‌نام کرده است. وارد شوید.'
  if (msg.includes('password should be at least'))
    return 'رمز عبور باید حداقل ۶ کاراکتر باشد.'
  if (msg.includes('unable to validate email') || msg.includes('invalid email'))
    return 'ایمیل معتبر نیست.'
  if (msg.includes('rate limit') || msg.includes('too many'))
    return 'تعداد تلاش‌ها زیاد بود. کمی بعد دوباره امتحان کنید.'
  if (msg.includes('signups not allowed') || msg.includes('signup is disabled'))
    return 'ثبت‌نام در حال حاضر بسته است.'
  if (msg.includes('same password')) return 'رمز جدید باید متفاوت باشد.'
  return raw
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabase()
    let alive = true

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!alive) return
        setSession(data.session ?? null)
      })
      .catch(() => {
        /* آفلاین: بدون نشست ادامه می‌دهیم */
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })

    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) throw error
  }, [])

  const signUp = useCallback(async (input: SignUpInput) => {
    const { data, error } = await getSupabase().auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        data: {
          full_name: input.fullName.trim(),
          unit: input.unit?.trim() || null,
          org: input.org?.trim() || null,
        },
      },
    })
    if (error) throw error
    return { needsConfirmation: !data.session }
  }, [])

  const signOut = useCallback(async () => {
    try {
      await getSupabase().auth.signOut()
    } catch {
      /* اگر آفلاین بود، نشست محلی پاک می‌شود */
    }
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    const redirectTo =
      typeof window !== 'undefined' ? window.location.origin + window.location.pathname : undefined
    const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo })
    if (error) throw error
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await getSupabase().auth.updateUser({ password })
    if (error) throw error
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      session,
      loading,
      email: session?.user?.email ?? '',
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
    }),
    [session, loading, signIn, signUp, signOut, resetPassword, updatePassword],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
