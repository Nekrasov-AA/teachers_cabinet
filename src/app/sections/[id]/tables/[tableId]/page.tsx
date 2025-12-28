import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserWithRole } from '@/lib/auth/requireRole';
import {
  addRowAction,
  deleteRowAction,
  deleteTableAction,
  updateTableSchemaAction,
} from '@/app/sections/actions';
import DeleteTableButton from '@/components/sections/DeleteTableButton';
import SchemaEditor from '@/components/sections/SchemaEditor';

type PageProps = {
  params: Promise<{ id: string; tableId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type ColumnType = 'string' | 'number' | 'boolean' | 'date';

type SchemaField = {
  key: string;
  label: string;
  type: ColumnType;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clampLimit(value: number) {
  if (!Number.isFinite(value)) return 50;
  return Math.min(200, Math.max(1, Math.floor(value)));
}

function normalizeOffset(value: number) {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

export default async function SectionTablePage({ params, searchParams }: PageProps) {
  const [{ id, tableId }, rawSearch] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const context = await getUserWithRole();
  const isAdmin = context.role === 'admin';

  const limit = clampLimit(Number(rawSearch?.limit ?? 50));
  const offset = normalizeOffset(Number(rawSearch?.offset ?? 0));

  const okMessage = typeof rawSearch?.ok === 'string' ? rawSearch.ok : null;
  const errorMessage = typeof rawSearch?.error === 'string' ? rawSearch.error : null;

  const { data: table, error: tableError } = await supabase
    .from('section_tables')
    .select('id, section_id, title, created_at, schema')
    .eq('id', tableId)
    .single();

  if (tableError || !table || table.section_id !== id) {
    notFound();
  }

  const rangeEnd = offset + limit;
  const { data: rawRows, error: rowsError } = await supabase
    .from('section_table_rows')
    .select('id, created_at, row')
    .eq('table_id', tableId)
    .order('created_at', { ascending: false })
    .range(offset, rangeEnd);

  if (rowsError) {
    throw new Error(rowsError.message);
  }

  const hasNext = (rawRows?.length ?? 0) > limit;
  const rows = rawRows ? rawRows.slice(0, limit) : [];
  const prevOffset = offset > 0 ? Math.max(offset - limit, 0) : 0;
  const nextOffset = offset + limit;

  const columnTypes: ColumnType[] = ['string', 'number', 'boolean', 'date'];

  const normalizedSchema = Array.isArray(table.schema)
    ? table.schema
        .map((field) => {
          if (!isRecord(field)) return null;
          const key = typeof field.key === 'string' ? field.key.trim() : '';
          if (!key) return null;
          const label =
            typeof field.label === 'string' && field.label.trim().length > 0 ? field.label.trim() : key;
          const rawType = typeof field.type === 'string' ? (field.type.trim() as ColumnType) : 'string';
          const type = columnTypes.includes(rawType) ? rawType : 'string';
          return { key, label, type } as SchemaField;
        })
        .filter((field): field is SchemaField => Boolean(field))
    : [];

  const inferredSchema: SchemaField[] = (() => {
    if (normalizedSchema.length > 0) {
      return normalizedSchema;
    }

    const keys = new Set<string>();
    rows.slice(0, 50).forEach((rowEntry) => {
      if (isRecord(rowEntry.row)) {
        Object.keys(rowEntry.row).forEach((key) => keys.add(key));
      }
    });

    return Array.from(keys)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => ({ key, label: key, type: 'string' } as SchemaField));
  })();

  const formatCellValue = (value: unknown) => {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return '[object]';
      }
    }

    return String(value);
  };

  const buildPageUrl = (nextOffsetValue: number) => {
    const query = new URLSearchParams();
    query.set('limit', String(limit));
    query.set('offset', String(nextOffsetValue));
    return `/sections/${id}/tables/${tableId}?${query.toString()}`;
  };

  const handleSaveSchema = async (formData: FormData) => {
    'use server';

    const schemaJson = (formData.get('schema_json') as string | null) ?? '';
    const query = new URLSearchParams();
    query.set('limit', String(limit));
    query.set('offset', String(offset));

    if (!schemaJson) {
      query.set('error', 'Схема пуста');
      redirect(`/sections/${id}/tables/${tableId}?${query.toString()}`);
    }

    try {
      await updateTableSchemaAction(id, tableId, schemaJson);
      query.set('ok', 'Схема обновлена');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось обновить схему';
      query.set('error', message);
    }

    redirect(`/sections/${id}/tables/${tableId}?${query.toString()}`);
  };

  const formSchema = inferredSchema;

  const handleAddRowFromSchema = async (formData: FormData) => {
    'use server';

    const query = new URLSearchParams();
    query.set('limit', String(limit));
    query.set('offset', String(offset));

    if (formSchema.length === 0) {
      query.set('error', 'Настройте схему перед добавлением строк');
      redirect(`/sections/${id}/tables/${tableId}?${query.toString()}`);
    }

    const row: Record<string, unknown> = {};

    formSchema.forEach((field) => {
      const rawValue = formData.get(field.key);

      switch (field.type) {
        case 'boolean':
          row[field.key] = rawValue === 'on';
          break;
        case 'number': {
          if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
            const parsed = Number(rawValue);
            row[field.key] = Number.isFinite(parsed) ? parsed : rawValue;
          } else {
            row[field.key] = null;
          }
          break;
        }
        case 'date': {
          if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
            const parsed = new Date(rawValue);
            row[field.key] = Number.isNaN(parsed.getTime()) ? rawValue : parsed.toISOString();
          } else {
            row[field.key] = null;
          }
          break;
        }
        default: {
          if (typeof rawValue === 'string') {
            const trimmed = rawValue.trim();
            row[field.key] = trimmed.length > 0 ? trimmed : null;
          } else {
            row[field.key] = rawValue ?? null;
          }
        }
      }
    });

    try {
      await addRowAction(tableId, row);
      query.set('offset', '0');
      query.set('ok', 'Строка добавлена');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось сохранить строку';
      query.set('error', message);
    }

    redirect(`/sections/${id}/tables/${tableId}?${query.toString()}`);
  };

  const handleAddRowJson = async (formData: FormData) => {
    'use server';

    const query = new URLSearchParams();
    query.set('limit', String(limit));

    const jsonPayload = (formData.get('row_json') as string | null) ?? '';
    if (!jsonPayload.trim()) {
      query.set('offset', String(offset));
      query.set('error', 'Вставьте JSON объекта');
      redirect(`/sections/${id}/tables/${tableId}?${query.toString()}`);
    }

    try {
      const parsed = JSON.parse(jsonPayload);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('JSON должен описывать объект');
      }

      await addRowAction(tableId, parsed as Record<string, unknown>);
      query.set('offset', '0');
      query.set('ok', 'Строка добавлена');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось сохранить строку';
      query.set('offset', String(offset));
      query.set('error', message);
    }

    redirect(`/sections/${id}/tables/${tableId}?${query.toString()}`);
  };

  const handleDeleteRowInline = async (formData: FormData) => {
    'use server';

    const query = new URLSearchParams();
    query.set('limit', String(limit));
    query.set('offset', String(offset));

    const rowId = (formData.get('rowId') as string | null)?.trim();
    if (!rowId) {
      query.set('error', 'Неизвестная строка');
      redirect(`/sections/${id}/tables/${tableId}?${query.toString()}`);
    }

    try {
      await deleteRowAction(id, tableId, rowId);
      query.set('ok', 'Строка удалена');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось удалить строку';
      query.set('error', message);
    }

    redirect(`/sections/${id}/tables/${tableId}?${query.toString()}`);
  };

  const handleDeleteTable = async () => {
    'use server';
    const successQuery = new URLSearchParams();

    try {
      await deleteTableAction(id, tableId);
      successQuery.set('ok', 'Таблица удалена');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось удалить таблицу';
      const failureQuery = new URLSearchParams();
      failureQuery.set('limit', String(limit));
      failureQuery.set('offset', String(offset));
      failureQuery.set('error', message);
      redirect(`/sections/${id}/tables/${tableId}?${failureQuery.toString()}`);
    }

    redirect(`/sections/${id}?${successQuery.toString()}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <Link href={`/sections/${id}`} className="text-sm font-medium text-indigo-600">
            ← Назад к разделу
          </Link>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm uppercase tracking-wide text-slate-400">Таблица</p>
            <h1 className="text-3xl font-semibold text-slate-900">{table.title}</h1>
            <p className="text-sm text-slate-500">
              ID: {table.id} · Создана{' '}
              {table.created_at ? new Date(table.created_at).toLocaleString('ru-RU') : '—'}
            </p>
          </div>
        </header>

        {okMessage ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {okMessage}
          </p>
        ) : null}
        {errorMessage ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            {errorMessage}
          </p>
        ) : null}

        {isAdmin ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">Колонки</h2>
            <p className="text-sm text-slate-500">Определите порядок и типы столбцов таблицы.</p>
            <div className="mt-4">
              <SchemaEditor initialColumns={normalizedSchema} saveAction={handleSaveSchema} />
            </div>
            {normalizedSchema.length === 0 && inferredSchema.length > 0 ? (
              <form action={handleSaveSchema} className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <input type="hidden" name="schema_json" value={JSON.stringify(inferredSchema)} />
                <p className="text-xs text-slate-500">Используется виртуальная схема ({inferredSchema.length} колонок)</p>
                <button
                  type="submit"
                  className="rounded-lg border border-slate-200 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Сохранить виртуальную схему
                </button>
              </form>
            ) : null}
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-slate-400">Строки</p>
              <h2 className="text-lg font-semibold text-slate-900">{rows.length} шт. на странице</h2>
            </div>
            <div className="flex gap-3">
              <Link
                href={buildPageUrl(prevOffset)}
                aria-disabled={offset === 0}
                className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                  offset === 0
                    ? 'cursor-not-allowed border-slate-200 text-slate-300'
                    : 'border-slate-300 text-slate-700 hover:border-slate-400'
                }`}
              >
                Prev
              </Link>
              <Link
                href={hasNext ? buildPageUrl(nextOffset) : buildPageUrl(offset)}
                aria-disabled={!hasNext}
                className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                  hasNext
                    ? 'border-slate-300 text-slate-700 hover:border-slate-400'
                    : 'cursor-not-allowed border-slate-200 text-slate-300'
                }`}
              >
                Next
              </Link>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="border-b border-slate-100 px-3 py-2">created_at</th>
                  {inferredSchema.map((field) => (
                    <th key={field.key} className="border-b border-slate-100 px-3 py-2">
                      {field.label}
                    </th>
                  ))}
                  {isAdmin ? <th className="border-b border-slate-100 px-3 py-2 text-right">Действия</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? (
                  rows.map((rowEntry) => (
                    <tr key={rowEntry.id} className="align-top">
                      <td className="border-b border-slate-50 px-3 py-2 text-xs text-slate-500">
                        {rowEntry.created_at
                          ? new Date(rowEntry.created_at).toLocaleString('ru-RU')
                          : '—'}
                      </td>
                      {inferredSchema.map((field) => {
                        const payload = isRecord(rowEntry.row) ? rowEntry.row : {};
                        const value = field.key in payload ? payload[field.key] : undefined;
                        return (
                          <td key={`${rowEntry.id}-${field.key}`} className="border-b border-slate-50 px-3 py-2">
                            <span className="text-sm text-slate-800">{formatCellValue(value)}</span>
                          </td>
                        );
                      })}
                      {isAdmin ? (
                        <td className="border-b border-slate-50 px-3 py-2 text-right">
                          <form action={handleDeleteRowInline}>
                            <input type="hidden" name="rowId" value={rowEntry.id} />
                            <button
                              type="submit"
                              className="text-xs font-medium text-rose-600 hover:text-rose-500"
                            >
                              Удалить
                            </button>
                          </form>
                        </td>
                      ) : null}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={isAdmin ? inferredSchema.length + 2 : inferredSchema.length + 1}
                      className="px-3 py-6 text-center text-sm text-slate-500"
                    >
                      Строк пока нет.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {rows.length > 0 ? (
            <details className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
              <summary className="cursor-pointer font-medium text-slate-900">Raw JSON</summary>
              <pre className="mt-3 max-h-60 overflow-auto text-xs text-slate-800">
                {JSON.stringify(rows, null, 2)}
              </pre>
            </details>
          ) : null}
        </section>

        {isAdmin ? (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-900">Добавить строку</h2>
              <p className="text-sm text-slate-500">
                Поля строятся по текущей схеме таблицы. Пустые значения сохраняются как null.
              </p>
              {formSchema.length > 0 ? (
                <form action={handleAddRowFromSchema} className="mt-4 space-y-4">
                  {formSchema.map((field) => (
                    <label key={field.key} className="block text-sm text-slate-600">
                      {field.label}
                      {field.type === 'boolean' ? (
                        <input
                          type="checkbox"
                          name={field.key}
                          className="ml-2 rounded border-slate-300 text-slate-900 focus:ring-indigo-500"
                        />
                      ) : field.type === 'number' ? (
                        <input
                          type="number"
                          step="any"
                          name={field.key}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                        />
                      ) : field.type === 'date' ? (
                        <input
                          type="date"
                          name={field.key}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                        />
                      ) : (
                        <input
                          type="text"
                          name={field.key}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                        />
                      )}
                    </label>
                  ))}
                  <button
                    type="submit"
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Сохранить строку
                  </button>
                </form>
              ) : (
                <p className="mt-4 text-sm text-slate-500">Настройте схему, чтобы добавлять строки через форму.</p>
              )}

              <details className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-900">Advanced: вставить JSON</summary>
                <p className="mt-2 text-xs text-slate-500">Можно добавить строку вручную, вставив JSON объекта.</p>
                <form action={handleAddRowJson} className="mt-3 flex flex-col gap-3">
                  <textarea
                    name="row_json"
                    rows={6}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                    placeholder='{"field":"value"}'
                  />
                  <div>
                    <button
                      type="submit"
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      Сохранить JSON
                    </button>
                  </div>
                </form>
              </details>
            </section>

            <section className="rounded-2xl border border-rose-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-rose-900">Опасная зона</h2>
              <p className="text-sm text-slate-500">
                Удаление таблицы приведёт к удалению всех строк. Действие необратимо.
              </p>
              <DeleteTableButton action={handleDeleteTable} />
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
