import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

function getSupabaseKey() {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key) throw new Error('Missing SUPABASE key in env (.env.local)');
  return key;
}

/**
 * Next.js 15: cookies() async -> поэтому createClient тоже async.
 * В Server Components cookies read-only, в Route Handlers/Server Actions можно сетить.
 * Мы делаем setAll безопасным (если set недоступен — просто пропускаем).
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL in env (.env.local)');

  const cookieStore = await cookies(); // <-- ВАЖНО: await

  return createServerClient(url, getSupabaseKey(), {
    cookies: {
      getAll() {
        // Next.js cookie store умеет getAll() (после await cookies())
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // В некоторых контекстах Next.js может не дать set (например Server Components).
        // Для MVP и health-check это ок; позже для auth-flows будем использовать route handlers/server actions.
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            // ts-expect-error - set может отсутствовать в read-only контекстах
            cookieStore.set?.(name, value, options);
          });
        } catch {
          // no-op
        }
      },
    },
  });
}