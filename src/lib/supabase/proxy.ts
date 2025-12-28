import { createServerClient } from '@supabase/ssr';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL in env (.env.local)');
  return url;
}

function getSupabaseKey() {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key) throw new Error('Missing SUPABASE key in env (.env.local)');
  return key;
}

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll().map(({ name, value }) => ({ name, value }));
      },
      async setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set({ name, value, ...options });
          try {
            request.cookies.set(name, value);
          } catch {
            // noop - NextRequest cookies can be read-only in some runtimes
          }
        }
      },
    },
  });

  const { error } = await supabase.auth.getUser();
  if (error) {
    console.warn('[supabase] middleware getUser error', error.message);
  }

  return response;
}
