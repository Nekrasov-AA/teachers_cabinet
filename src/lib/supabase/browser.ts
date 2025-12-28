import { createBrowserClient } from '@supabase/ssr';

function getSupabaseKey() {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key) throw new Error('Missing SUPABASE key in env (.env.local)');
  return key;
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL in env (.env.local)');

  return createBrowserClient(url, getSupabaseKey());
}
