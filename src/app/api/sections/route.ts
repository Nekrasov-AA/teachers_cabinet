import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AuthError, getUserWithRole, requireRole } from '@/lib/auth/requireRole';

function parseOrderIndex(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET() {
  try {
    await getUserWithRole();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('sections')
      .select('id, title, parent_id, order_index, created_at')
      .order('order_index', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, sections: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = error instanceof AuthError ? error.status : 500;
    return NextResponse.json({ ok: false, message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    await requireRole('admin');
    const body = await request.json().catch(() => null);
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const parentId = typeof body?.parentId === 'string' && body.parentId.length > 0 ? body.parentId : null;
    const orderIndex = parseOrderIndex(body?.orderIndex);

    if (!title) {
      return NextResponse.json({ ok: false, message: 'title is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('sections')
      .insert({ title, parent_id: parentId, order_index: orderIndex })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, section: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = error instanceof AuthError ? error.status : 500;
    return NextResponse.json({ ok: false, message }, { status });
  }
}
