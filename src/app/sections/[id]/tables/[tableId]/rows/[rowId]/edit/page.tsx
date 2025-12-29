import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/requireRole';
import { updateRowFromSchemaAction } from '../../../actions';
import Toast from '@/components/Toast';
import type { SchemaField, ColumnType } from '@/lib/tables/schemaForm';

type PageProps = {
  params: Promise<{ id: string; tableId: string; rowId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatValueForInput(value: unknown, type: ColumnType): string {
  if (value === null || value === undefined) return '';
  
  if (type === 'date' && typeof value === 'string') {
    // Если ISO datetime, преобразуем в YYYY-MM-DD
    try {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch {
      return String(value);
    }
  }

  return String(value);
}

export default async function EditRowPage({ params, searchParams }: PageProps) {
  await requireRole('admin');
  
const [{ id, tableId, rowId }, rawSearch] = await Promise.all([params, searchParams]);
const supabase = await createClient();
const okMessage = typeof rawSearch?.ok === 'string' ? rawSearch.ok : null;
const errorMessage = typeof rawSearch?.error === 'string' ? rawSearch.error : null;

  const { data: table, error: tableError } = await supabase
    .from('section_tables')
    .select('id, section_id, title, schema')
    .eq('id', tableId)
    .single();

  if (tableError || !table || table.section_id !== id) {
    notFound();
  }

  const { data: rowData, error: rowError } = await supabase
    .from('section_table_rows')
    .select('id, row')
    .eq('id', rowId)
    .eq('table_id', tableId)
    .single();

  if (rowError || !rowData) {
    notFound();
  }

  const columnTypes: ColumnType[] = ['string', 'number', 'boolean', 'date'];

  const schema: SchemaField[] = Array.isArray(table.schema)
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

  if (schema.length === 0) {
    redirect(`/sections/${id}/tables/${tableId}?error=Схема таблицы пуста`);
  }

  const rowPayload = isRecord(rowData.row) ? rowData.row : {};

  const handleUpdate = async (formData: FormData) => {
    'use server';

    try {
      await updateRowFromSchemaAction(id, tableId, rowId, schema, formData);
      redirect(`/sections/${id}/tables/${tableId}/rows/${rowId}/edit?ok=${encodeURIComponent('Строка успешно обновлена')}`);
    } catch (error) {
      // Next.js redirect throws a special error with digest property
      if (error && typeof error === 'object' && 'digest' in error) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Не удалось обновить строку';
      redirect(`/sections/${id}/tables/${tableId}/rows/${rowId}/edit?error=${encodeURIComponent(message)}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      {okMessage && <Toast message={okMessage} type="success" />}
      {errorMessage && <Toast message={errorMessage} type="error" />}
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <Link href={`/sections/${id}/tables/${tableId}`} className="text-sm font-medium text-indigo-600">
            ← Назад к таблице
          </Link>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm uppercase tracking-wide text-slate-400">Редактирование строки</p>
            <h1 className="text-2xl font-semibold text-slate-900">{table.title}</h1>
            <p className="text-sm text-slate-500">ID строки: {rowId}</p>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Поля</h2>
          <p className="text-sm text-slate-500 mb-4">Измените значения и нажмите Сохранить.</p>

          <form action={handleUpdate} className="space-y-4">
            {schema.map((field) => {
              const currentValue = field.key in rowPayload ? rowPayload[field.key] : null;

              return (
                <label key={field.key} className="block text-sm text-slate-600">
                  {field.label}
                  {field.type === 'boolean' ? (
                    <input
                      type="checkbox"
                      name={field.key}
                      defaultChecked={Boolean(currentValue)}
                      className="ml-2 rounded border-slate-300 text-slate-900 focus:ring-indigo-500"
                    />
                  ) : field.type === 'number' ? (
                    <input
                      type="number"
                      step="any"
                      name={field.key}
                      defaultValue={formatValueForInput(currentValue, field.type)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  ) : field.type === 'date' ? (
                    <input
                      type="date"
                      name={field.key}
                      defaultValue={formatValueForInput(currentValue, field.type)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  ) : (
                    <input
                      type="text"
                      name={field.key}
                      defaultValue={formatValueForInput(currentValue, field.type)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  )}
                </label>
              );
            })}

            <div className="flex gap-3">
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Сохранить
              </button>
              <Link
                href={`/sections/${id}/tables/${tableId}`}
                className="rounded-lg border border-slate-200 bg-white px-6 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Отмена
              </Link>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
