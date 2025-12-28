import { createClient } from '@supabase/supabase-js';

/**
 * Админ-клиент Supabase для серверных операций (upload/delete и т.п.)
 * ВАЖНО: использует service role key — НИКОГДА не импортировать это в client components.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL in env');
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in env');

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}