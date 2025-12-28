import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AuthError, requireRole } from '@/lib/auth/requireRole';

function jsonError(status: number, where: string, message: string) {
  return NextResponse.json({ ok: false, where, message }, { status });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { tableId: string; rowId: string } }
) {
  try {
    await requireRole('admin');
    const { tableId, rowId } = params;

    if (!tableId || !rowId) {
      return jsonError(400, 'params', 'tableId и rowId обязательны');
    }

    const supabase = await createClient();
    const { data: rowRecord, error: rowError } = await supabase
      .from('section_table_rows')
      .select('id, table_id')
      .eq('id', rowId)
      .single();

    if (rowError || !rowRecord) {
      return jsonError(404, 'row', 'Строка не найдена');
    }

    if (rowRecord.table_id !== tableId) {
      return jsonError(400, 'row', 'Строка не принадлежит указанной таблице');
    }

    const { error: deleteError } = await supabase.from('section_table_rows').delete().eq('id', rowId);
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
