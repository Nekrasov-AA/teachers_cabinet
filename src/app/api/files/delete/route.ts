import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthError, requireRole } from '@/lib/auth/requireRole';

export const runtime = 'nodejs';

export async function DELETE(request: Request) {
  try {
    await requireRole('admin');

    const body = await request.json().catch(() => null);
    const path = typeof body?.path === 'string' ? body.path.trim() : null;

    if (!path) {
      return NextResponse.json({ ok: false, message: 'Provide JSON { "path": "files/.." }' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase.storage.from('files').remove([path]);

    if (error) {
      return NextResponse.json(
        { ok: false, where: 'storage.remove', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, path });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
