import { NextResponse } from 'next/server';
import { AuthError, requireRole } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { ExcelParseError, parseExcelBuffer } from '@/lib/excel/parse';

export const runtime = 'nodejs';

function jsonError(status: number, where: string, message: string) {
  return NextResponse.json({ ok: false, where, message }, { status });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole('admin');
    const { id: sectionId } = params;

    const supabase = await createClient();
    const { data: sectionRecord, error: sectionError } = await supabase
      .from('sections')
      .select('id')
      .eq('id', sectionId)
      .single();

    if (sectionError || !sectionRecord) {
      return jsonError(404, 'section', 'Раздел не найден');
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return jsonError(400, 'file', 'Прикрепите Excel файл');
    }

    if (file.size === 0) {
      return jsonError(400, 'file', 'Файл пуст');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let parsed;

    try {
      parsed = parseExcelBuffer(buffer, { maxRows: 2000 });
    } catch (parseError) {
      if (parseError instanceof ExcelParseError) {
        return jsonError(400, 'excel', parseError.message);
      }
      throw parseError;
    }

    return NextResponse.json({
      ok: true,
      columns: parsed.columns,
      sampleRows: parsed.rows.slice(0, 10),
      totalRows: parsed.totalRows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    const status = error instanceof AuthError ? error.status : 500;
    return NextResponse.json({ ok: false, where: 'server', message }, { status });
  }
}
