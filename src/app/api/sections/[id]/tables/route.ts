import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AuthError, getUserWithRole, requireRole } from '@/lib/auth/requireRole';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await getUserWithRole();
    const { id } = params;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('section_tables')
      .select('id, section_id, title, schema, created_by, created_at')
      .eq('section_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, tables: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = error instanceof AuthError ? error.status : 500;
    return NextResponse.json({ ok: false, message }, { status });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { user } = await requireRole('admin');
    const { id } = params;
    const body = await request.json().catch(() => null);
    const title = typeof body?.title === 'string' ? body.title.trim() : '';

    if (!title) {
      return NextResponse.json({ ok: false, message: 'title is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('section_tables')
      .insert({
        section_id: id,
        title,
        schema: [],
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, table: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = error instanceof AuthError ? error.status : 500;
    return NextResponse.json({ ok: false, message }, { status });
  }
}
