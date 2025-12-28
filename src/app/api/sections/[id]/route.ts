import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AuthError, requireRole } from '@/lib/auth/requireRole';

function parseOrderIndex(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole('admin');
    const body = await request.json().catch(() => null);
    const updates: Record<string, unknown> = {};

    if (typeof body?.title === 'string') {
      const title = body.title.trim();
      if (title) {
        updates.title = title;
      }
    }

    if (typeof body?.parentId === 'string') {
      updates.parent_id = body.parentId || null;
    }

    const orderIndex = parseOrderIndex(body?.orderIndex);
    if (typeof orderIndex === 'number') {
      updates.order_index = orderIndex;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: false, message: 'Nothing to update' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('sections')
      .update(updates)
      .eq('id', params.id)
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

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole('admin');
    const supabase = await createClient();
    const { error } = await supabase.from('sections').delete().eq('id', params.id);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = error instanceof AuthError ? error.status : 500;
    return NextResponse.json({ ok: false, message }, { status });
  }
}
