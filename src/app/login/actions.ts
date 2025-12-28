'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function extractCredentials(formData: FormData) {
  const email = formData.get('email');
  const password = formData.get('password');

  if (typeof email !== 'string' || typeof password !== 'string') {
    redirect('/login?error=Missing%20credentials');
  }

  return { email, password };
}

function redirectWithError(message: string) {
  redirect(`/login?error=${encodeURIComponent(message)}`);
}

async function handleSuccessRedirect() {
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function login(formData: FormData) {
  const { email, password } = extractCredentials(formData);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirectWithError(error.message);
  }

  await handleSuccessRedirect();
}

export async function signup(formData: FormData) {
  const { email, password } = extractCredentials(formData);
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirectWithError(error.message);
  }

  await handleSuccessRedirect();
}
