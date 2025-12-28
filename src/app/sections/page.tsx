import Link from 'next/link';
import SectionSidebar from '@/components/sections/SectionSidebar';
import { getUserWithRole } from '@/lib/auth/requireRole';

export default async function SectionsIndexPage() {
  await getUserWithRole();

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <SectionSidebar />
      <main className="flex-1 px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Выберите раздел</h1>
          <p className="mt-3 text-sm text-slate-600">
            Все разделы и подразделы доступны в меню слева. Нажмите на любой пункт, чтобы открыть файлы и действия.
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Если разделов ещё нет, зайдите на главную страницу как admin и создайте дерево разделов.
          </p>
          <div className="mt-6 flex justify-center gap-4 text-sm">
            <Link href="/" className="font-medium text-indigo-600">
              На главную
            </Link>
            <Link href="/api/sections" className="text-slate-500">
              API: /api/sections
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
