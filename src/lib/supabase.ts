import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * کلیدهای عمومی پروژه Supabase «حضور و غیاب».
 * این‌ها کلید عمومی (anon/publishable) هستند و بودنشان در کد کلاینت اشکالی ندارد؛
 * دسترسی واقعی با Row Level Security محدود شده است.
 * در Vercel می‌توانید با VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY مقادیر را عوض کنید.
 */
const DEFAULT_URL = 'https://nddpltibyfexvukbcgqi.supabase.co'
const DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kZHBsdGlieWZleHZ1a2JjZ3FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyMzE0NTYsImV4cCI6MjEwOTgwNzQ1Nn0.SyKysrAyO6aPyda7gKmIzbLKZHPoBpX98iaPG9YxKcY'

function env(key: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string | undefined {
  const value = (import.meta.env as Record<string, string | undefined>)[key]
  return value && value.trim() ? value.trim() : undefined
}

export const SUPABASE_URL = (env('VITE_SUPABASE_URL') || DEFAULT_URL).replace(/\/+$/, '')
export const SUPABASE_ANON_KEY = env('VITE_SUPABASE_ANON_KEY') || DEFAULT_ANON_KEY

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'hozor.auth.v1',
      },
      global: { headers: { 'x-application-name': 'hozor-attendance' } },
    })
  }
  return client
}
