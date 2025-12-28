import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AuthError, requireRole } from '@/lib/auth/requireRole';

type ParamsPromise = Promise<{ id: string; tableId: string }>;

function jsonError(status: number, where: string, message: string) {
  return NextResponse.json({ ok: false, where, message }, { status });
}

export async function DELETE(_request: Request, { params }: { params: ParamsPromise }) {
  try {
    await requireRole('admin');
    const { id: sectionId, tableId } = await params;

    const supabase = await createClient();
    const { data: tableRecord, error: tableError } = await supabase
      .from('section_tables')
      .select('id, section_id')
      .eq('id', tableId)
      .single();

    if (tableError || !tableRecord) {
      return jsonError(404, 'table', 'Таблица не найдена');
    }

    if (tableRecord.section_id !== sectionId) {
      return jsonError(400, 'table', 'Таблица принадлежит другому разделу');
    }

    const { error: deleteError } = await supabase
      .from('section_tables')
      .delete()
      .eq('id', tableId)
      .eq('section_id', sectionId);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    const status = error instanceof AuthError ? error.status : 500;
    return NextResponse.json({ ok: false, where: 'server', message }, { status });
  }
}
