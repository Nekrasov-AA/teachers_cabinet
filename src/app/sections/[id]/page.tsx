import Link from 'next/link';
import { notFound } from 'next/navigation';
import SectionSidebar from '@/components/sections/SectionSidebar';
import UploadSectionFileForm from '@/components/sections/UploadSectionFileForm';
import { createClient } from '@/lib/supabase/server';
import { getUserWithRole } from '@/lib/auth/requireRole';
import { uploadSectionFileAction, deleteSectionFileAction } from '@/app/sections/actions';

function formatBytes(size?: number | null) {
  if (!size || size <= 0) return '—';
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
}

export default async function SectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getUserWithRole();
  const supabase = await createClient();

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

  const uploadAction = uploadSectionFileAction.bind(null, id);
  const deleteAction = deleteSectionFileAction.bind(null, id);
  const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

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

          {context.role === 'admin' ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-900">Загрузить файл</h2>
              <p className="text-sm text-slate-600">Файлы свяжутся с этим разделом.</p>
              <UploadSectionFileForm uploadAction={uploadAction} />
            </section>
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
