import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { AuthError, requireRole } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { ExcelParseError, parseExcelBuffer } from '@/lib/excel/parse';
import { validateColumns, validateRows } from '@/lib/excel/validate';
import { logAuditEvent } from '@/lib/audit/log';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ROWS = 2000;
const CHUNK_SIZE = 300;

type ParamsPromise = Promise<{ id: string }>;

function jsonError(status: number, where: string, message: string) {
  return NextResponse.json({ ok: false, where, message }, { status });
}

function buildTableTitle(fileName?: string | null) {
  if (fileName) {
    const withoutExt = fileName.replace(/\.[^.]+$/, '').trim();
    if (withoutExt.length > 0) {
      return withoutExt.slice(0, 120);
    }
  }

  const formatter = new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `Импорт ${formatter.format(new Date())}`;
}

async function cleanupTable(tableId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  await supabase.from('section_table_rows').delete().eq('table_id', tableId);
  await supabase.from('section_tables').delete().eq('id', tableId);
}

export async function POST(request: Request, { params }: { params: ParamsPromise }) {
  try {
    const { user } = await requireRole('admin');
    const { id: sectionId } = await params;
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

    if (file.size > MAX_FILE_SIZE) {
      return jsonError(400, 'file', 'Файл больше 10MB');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let parsed;

    try {
      parsed = parseExcelBuffer(buffer, { maxRows: MAX_ROWS });
    } catch (parseError) {
      if (parseError instanceof ExcelParseError) {
        return jsonError(400, 'excel', parseError.message);
      }
      throw parseError;
    }

    if (!parsed.columns.length) {
      return jsonError(400, 'excel', 'Колонки не найдены');
    }

    if (!parsed.rows.length) {
      return jsonError(400, 'excel', 'Нет строк для импорта');
    }

    // Валидация структуры колонок
    const columnsValidation = validateColumns(parsed.columns);
    if (columnsValidation) {
      return jsonError(400, 'schema', columnsValidation);
    }

    // Валидация первых строк данных
    const rowsValidation = validateRows(parsed.rows, parsed.columns, 5);
    if (!rowsValidation.valid) {
      const errorMessage = rowsValidation.errors.join('; ');
      return jsonError(400, 'rows', `Ошибки в данных: ${errorMessage}`);
    }

    const tableTitle = buildTableTitle(file.name);

    const { data: tableRecord, error: tableError } = await supabase
      .from('section_tables')
      .insert({
        section_id: sectionId,
        title: tableTitle,
        schema: parsed.columns,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (tableError || !tableRecord) {
      return jsonError(500, 'table', tableError?.message ?? 'Не удалось создать таблицу');
    }

    try {
      for (let index = 0; index < parsed.rows.length; index += CHUNK_SIZE) {
        const chunk = parsed.rows.slice(index, index + CHUNK_SIZE);
        const payload = chunk.map((row) => ({
          table_id: tableRecord.id,
          row,
          created_by: user.id,
        }));

        const { error: rowsError } = await supabase.from('section_table_rows').insert(payload);
        if (rowsError) {
          throw new Error(rowsError.message);
        }
      }
    } catch (insertError) {
      await cleanupTable(tableRecord.id, supabase);
      return jsonError(500, 'rows', insertError instanceof Error ? insertError.message : 'Ошибка импорта');
    }

    revalidatePath('/', 'page');
    revalidatePath('/sections');
    revalidatePath(`/sections/${sectionId}`);
    revalidatePath(`/sections/${sectionId}/tables/${tableRecord.id}`);

    await logAuditEvent({
      action: 'table.import_excel',
      actorId: user.id,
      sectionId,
      tableId: tableRecord.id,
      metadata: {
        fileName: file.name,
        rows: parsed.rows.length,
        columns: parsed.columns.length,
      },
    });

    return NextResponse.json({
      ok: true,
      tableId: tableRecord.id,
      importedRows: parsed.rows.length,
      importedColumns: parsed.columns.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    const status = error instanceof AuthError ? error.status : 500;
    return NextResponse.json({ ok: false, where: 'server', message }, { status });
  }
}
