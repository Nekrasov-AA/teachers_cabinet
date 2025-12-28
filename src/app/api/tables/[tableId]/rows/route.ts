import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AuthError, getUserWithRole, requireRole } from '@/lib/auth/requireRole';

type ParamsPromise = Promise<{ tableId: string }>;

function parseLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 50;
  }

  return Math.min(Math.floor(parsed), 200);
}

function parseOffset(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function GET(request: Request, { params }: { params: ParamsPromise }) {
  try {
    await getUserWithRole();
    const { tableId } = await params;
    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get('limit'));
    const offset = parseOffset(url.searchParams.get('offset'));
    const to = offset + limit - 1;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('section_table_rows')
      .select('id, row, created_by, created_at')
      .eq('table_id', tableId)
      .order('created_at', { ascending: false })
      .range(offset, to);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, rows: data ?? [], limit, offset });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = error instanceof AuthError ? error.status : 500;
    return NextResponse.json({ ok: false, message }, { status });
  }
}

export async function POST(request: Request, { params }: { params: ParamsPromise }) {
  try {
    const { user } = await requireRole('admin');
    const { tableId } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { ok: false, message: 'Некорректный JSON' },
        { status: 400 }
      );
    }

    const row = (body as Record<string, unknown>)?.row;

    if (!isPlainObject(row)) {
      return NextResponse.json(
        { ok: false, message: 'Поле "row" должно быть объектом' },
        { status: 400 }
      );
    }

    // Валидация размера объекта
    const rowString = JSON.stringify(row);
    if (rowString.length > 100000) {
      return NextResponse.json(
        { ok: false, message: 'Данные строки слишком большие (макс 100KB)' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: table, error: tableError } = await supabase
      .from('section_tables')
      .select('id')
      .eq('id', tableId)
      .single();

    if (tableError || !table) {
      return NextResponse.json(
        { ok: false, message: 'Таблица не найдена' },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from('section_table_rows')
      .insert({
        table_id: tableId,
        row,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, row: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    const status = error instanceof AuthError ? error.status : 500;
    console.error('[POST /api/tables/:tableId/rows]', message, error);
    return NextResponse.json({ ok: false, message }, { status });
  }
}
