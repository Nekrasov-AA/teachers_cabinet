import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.getUser();
    const userErrorMessage = error?.message ?? null;

    if (error && userErrorMessage && !userErrorMessage.toLowerCase().includes('session')) {
      return NextResponse.json(
        { ok: false, where: 'supabase.auth.getUser', message: userErrorMessage },
        { status: 500 }
      );
    }

    const user = data.user ?? null;
    const diagnostics = user
      ? undefined
      : {
          cookieNames: request.cookies.getAll().map(({ name }) => name),
        };

    return NextResponse.json({
      ok: true,
      hasUser: Boolean(user),
      user: user ? { id: user.id, email: user.email } : null,
      diagnostics,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ ok: false, where: 'api', message }, { status: 500 });
  }
}