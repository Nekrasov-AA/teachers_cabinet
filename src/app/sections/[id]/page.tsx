import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import SectionSidebar from '@/components/sections/SectionSidebar';
import UploadSectionFileForm from '@/components/sections/UploadSectionFileForm';
import ExcelImportPreview from '@/components/sections/ExcelImportPreview';
import ExcelImportForm from '@/components/sections/ExcelImportForm';
import { createClient } from '@/lib/supabase/server';
import { getUserWithRole } from '@/lib/auth/requireRole';
import {
  uploadSectionFileAction,
  deleteSectionFileAction,
  createTableAction,
} from '@/app/sections/actions';

function formatBytes(size?: number | null) {
  if (!size || size <= 0) return '—';
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
}

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SectionPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const context = await getUserWithRole();
  const supabase = await createClient();
  const resolvedSearchParams = await searchParams;
  const okMessage = typeof resolvedSearchParams?.ok === 'string' ? resolvedSearchParams.ok : null;
  const errorMessage =
    typeof resolvedSearchParams?.error === 'string' ? resolvedSearchParams.error : null;

  const { data: section, error: sectionError } = await supabase
    .from('sections')
    .select('id, title, parent_id, order_index, created_at')
    .eq('id', id)
    .single();

  if (sectionError || !section) {
    notFound();
  }

  const { data: files, error: filesError } = await supabase
    .from('section_files')
    .select('id, path, original_name, mime_type, size, created_at')
    .eq('section_id', id)
    .order('created_at', { ascending: false });

  if (filesError) {
    throw new Error(filesError.message);
  }

  const { data: tables, error: tablesError } = await supabase
    .from('section_tables')
    .select('id, title, created_at')
    .eq('section_id', id)
    .order('created_at', { ascending: false });

  if (tablesError) {
    throw new Error(tablesError.message);
  }

  const uploadAction = async (formData: FormData) => {
    'use server';

    const query = new URLSearchParams();

    try {
      await uploadSectionFileAction(id, formData);
      query.set('ok', 'Файл загружен');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось загрузить файл';
      query.set('error', message);
    }

    redirect(`/sections/${id}?${query.toString()}`);
  };

  const deleteAction = async (formData: FormData) => {
    'use server';

    const query = new URLSearchParams();

    try {
      await deleteSectionFileAction(id, formData);
      query.set('ok', 'Файл удалён');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось удалить файл';
      query.set('error', message);
    }

    redirect(`/sections/${id}?${query.toString()}`);
  };
  const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const handleCreateTable = async (formData: FormData) => {
    'use server';

    const title = (formData.get('title') as string | null)?.trim() ?? '';
    const query = new URLSearchParams();

    if (!title) {
      query.set('error', 'Название таблицы обязательно');
      redirect(`/sections/${id}?${query.toString()}`);
    }

    try {
      await createTableAction(id, title);
      query.set('ok', 'Таблица создана');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось создать таблицу';
      query.set('error', message);
    }

    redirect(`/sections/${id}?${query.toString()}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <SectionSidebar activeSectionId={id} />
      <main className="flex-1 px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-8">
          <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-3">
              <Link href="/" className="text-sm font-medium text-indigo-600">
                ← На главную
              </Link>
            </div>
            <p className="text-sm uppercase tracking-wide text-slate-400">Раздел</p>
            <h1 className="text-3xl font-semibold text-slate-900">{section.title}</h1>
            <p className="text-sm text-slate-500">
              ID: {section.id} · Порядок: {section.order_index}
            </p>
          </header>

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-wide text-slate-400">Таблицы</p>
                <h2 className="text-lg font-semibold text-slate-900">
                  {tables?.length ?? 0} шт.
                </h2>
              </div>
              {context.role === 'admin' ? (
                <form
                  action={handleCreateTable}
                  className="flex w-full flex-col gap-2 md:w-auto md:flex-row"
                >
                  <label className="flex-1 text-sm text-slate-600">
                    <span className="sr-only">Название таблицы</span>
                    <input
                      type="text"
                      name="title"
                      placeholder="Новая таблица"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Создать
                  </button>
                </form>
              ) : null}
            </div>

            {okMessage ? (
              <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                {okMessage}
              </p>
            ) : null}
            {errorMessage ? (
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                {errorMessage}
              </p>
            ) : null}

            {tables && tables.length > 0 ? (
              <ul className="mt-4 divide-y divide-slate-100">
                {tables.map((table) => (
                  <li key={table.id} className="py-3">
                    <Link
                      href={`/sections/${id}/tables/${table.id}`}
                      className="flex flex-col rounded-xl border border-transparent px-2 py-2 transition hover:border-indigo-100 hover:bg-indigo-50/40"
                    >
                      <span className="font-medium text-slate-900">{table.title}</span>
                      <span className="text-xs text-slate-500">
                        {table.created_at ? new Date(table.created_at).toLocaleString('ru-RU') : '—'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                В этом разделе пока нет таблиц.
              </p>
            )}
          </section>

          {context.role === 'admin' ? (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-lg font-semibold text-slate-900">Импорт Excel (превью)</h2>
                <p className="text-sm text-slate-600">
                  Постройте схему и посмотрите первые строки перед загрузкой в таблицу. Ничего не
                  сохраняется, это только предпросмотр.
                </p>
                <div className="mt-4">
                  <ExcelImportPreview sectionId={id} />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-lg font-semibold text-slate-900">Импорт Excel (в таблицу)</h2>
                <p className="text-sm text-slate-600">
                  Файл преобразуется в новую таблицу с колонками по первой строке. Поддерживаются файлы до
                  10MB и максимум 2000 строк.
                </p>
                <div className="mt-4">
                  <ExcelImportForm sectionId={id} />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-lg font-semibold text-slate-900">Загрузить файл</h2>
                <p className="text-sm text-slate-600">Файлы свяжутся с этим разделом.</p>
                <UploadSectionFileForm uploadAction={uploadAction} />
              </section>
            </>
          ) : null}

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Файлы</h2>
              <p className="text-sm text-slate-500">{files?.length ?? 0} шт.</p>
            </div>
            {files && files.length > 0 ? (
              <ul className="mt-4 divide-y divide-slate-100">
                {files.map((file) => {
                  const url = storageUrl
                    ? `${storageUrl}/storage/v1/object/public/files/${file.path}`
                    : null;
                  return (
                    <li key={file.id} className="flex flex-col gap-2 py-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{file.original_name}</p>
                        <p className="text-xs text-slate-500">
                          {file.mime_type || 'unknown'} · {formatBytes(file.size)} ·{' '}
                          {new Date(file.created_at ?? '').toLocaleString('ru-RU')}
                        </p>
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer" className="text-xs font-medium text-indigo-600">
                            Скачать
                          </a>
                        ) : null}
                      </div>
                      {context.role === 'admin' ? (
                        <form action={deleteAction} className="self-start md:self-auto">
                          <input type="hidden" name="fileId" value={file.id} />
                          <button
                            type="submit"
                            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600"
                          >
                            Удалить
                          </button>
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-slate-500">В этом разделе ещё нет файлов.</p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
