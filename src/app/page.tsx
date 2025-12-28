import type { JSX } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AuthError, getUserWithRole } from '@/lib/auth/requireRole';
import { buildSectionsTree, type SectionNode, type SectionRecord } from '@/lib/sections/tree';
import { createTeacherAction, resetTeacherPasswordAction } from '@/app/admin/actions';
import { createSectionAction } from './sections/actions';

function renderTree(nodes: SectionNode[], depth = 0): JSX.Element[] {
  return nodes.map((node) => (
    <li key={node.id} className="space-y-1">
      <Link
        href={`/sections/${node.id}`}
        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition hover:border-slate-300 hover:bg-slate-50"
      >
        <span style={{ marginLeft: depth * 12 }}>{node.title}</span>
        <span className="text-xs text-slate-400">#{node.order_index}</span>
      </Link>
      {node.children.length > 0 ? (
        <ul className="ml-4 border-l border-slate-100 pl-3">
          {renderTree(node.children, depth + 1)}
        </ul>
      ) : null}
    </li>
  ));
}

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps = {}) {
  try {
    const resolvedSearchParams = searchParams ? await searchParams : undefined;
    const userActionOk =
      typeof resolvedSearchParams?.userOk === 'string' ? resolvedSearchParams.userOk : null;
    const userActionError =
      typeof resolvedSearchParams?.userError === 'string'
        ? resolvedSearchParams.userError
        : null;

    const context = await getUserWithRole();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('sections')
      .select('id, title, parent_id, order_index')
      .order('order_index', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const sections = (data as SectionRecord[]) ?? [];

    if (context.role === 'teacher') {
      if (sections.length > 0) {
        redirect(`/sections/${sections[0].id}`);
      }

      return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10 text-center">
          <div className="max-w-md space-y-4">
            <p className="text-sm text-slate-500">Вы вошли как teacher</p>
            <p className="text-2xl font-semibold text-slate-900">Разделы ещё не созданы</p>
            <p className="text-sm text-slate-600">
              Попросите администратора добавить первый раздел. После появления меню вас автоматически
              перенаправят на /sections.
            </p>
            <Link href="/sections" className="text-sm font-medium text-indigo-600">
              Перейти к разделам
            </Link>
          </div>
        </main>
      );
    }

    const tree = buildSectionsTree(sections);
    const canCreateChild = sections.length > 0;

    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Signed in as</p>
            <p className="text-xl font-semibold text-slate-900">{context.user.email}</p>
            <p className="text-sm text-slate-600">
              Role: <span className="font-medium capitalize">{context.role}</span>
            </p>
            {context.profile.full_name ? (
              <p className="text-sm text-slate-600">{context.profile.full_name}</p>
            ) : null}
          </header>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-lg font-semibold text-slate-900">Новый раздел</h2>
                <p className="text-sm text-slate-600">Создайте корневой раздел меню.</p>
                <form action={createSectionAction} className="mt-4 space-y-3" data-testid="create-section-form">
                  <label className="block text-sm">
                    <span className="text-slate-600">Название</span>
                    <input
                      name="title"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-black"
                      placeholder="Например: Методические материалы"
                      required
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-600">Порядок (0+)</span>
                    <input
                      name="orderIndex"
                      type="number"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-black"
                      defaultValue={0}
                    />
                  </label>
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                  >
                    + Создать раздел
                  </button>
                </form>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-lg font-semibold text-slate-900">Подраздел</h2>
                <p className="text-sm text-slate-600">Привяжите к существующему разделу.</p>
                <form action={createSectionAction} className="mt-4 space-y-3">
                  <label className="block text-sm">
                    <span className="text-slate-600">Родитель</span>
                    <select
                      name="parentId"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100 text-black"
                      required
                      defaultValue=""
                      disabled={!canCreateChild}
                    >
                      <option value="" disabled>
                        Выберите раздел
                      </option>
                      {sections.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-600">Название</span>
                    <input
                      name="title"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-black"
                      placeholder="Например: Аттестация"
                      required
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-600">Порядок</span>
                    <input
                      name="orderIndex"
                      type="number"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-black"
                      defaultValue={0}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={!canCreateChild}
                    className={`w-full rounded-lg border px-3 py-2 text-sm font-medium ${
                      canCreateChild ? 'border-slate-200 text-slate-900' : 'border-slate-200 text-slate-400'
                    }`}
                  >
                    + Создать подраздел
                  </button>
                </form>
              </div>

              {userActionOk ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  {userActionOk}
                </p>
              ) : null}
              {userActionError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                  {userActionError}
                </p>
              ) : null}

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-lg font-semibold text-slate-900">Создать пользователя</h2>
                <p className="text-sm text-slate-600">
                  Завуч указывает почту и, при необходимости, ФИО. Можно отправить приглашение или выдать временный пароль.
                </p>
                <form action={createTeacherAction} className="mt-4 space-y-3">
                  <label className="block text-sm">
                    <span className="text-slate-600">Email</span>
                    <input
                      type="email"
                      name="email"
                      required
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-black"
                      placeholder="teacher@example.com"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-600">ФИО (опционально)</span>
                    <input
                      type="text"
                      name="fullName"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-black"
                      placeholder="Иванова Анна"
                    />
                  </label>
                  <fieldset className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
                    <legend className="text-xs uppercase tracking-wide text-slate-400">Способ доступа</legend>
                    <label className="mt-2 flex cursor-pointer items-start gap-2">
                      <input type="radio" name="mode" value="invite" defaultChecked />
                      <div>
                        <p className="font-medium text-slate-900">Письмо-приглашение</p>
                        <p className="text-xs text-slate-500">
                          Supabase отправит учителю письмо. Он задаст пароль по ссылке.
                        </p>
                      </div>
                    </label>
                    <label className="mt-3 flex cursor-pointer items-start gap-2">
                      <input type="radio" name="mode" value="password" />
                      <div>
                        <p className="font-medium text-slate-900">Временный пароль</p>
                        <p className="text-xs text-slate-500">
                          Пароль задаётся вручную. Учителю нужно будет сменить его при первом входе.
                        </p>
                      </div>
                    </label>
                  </fieldset>
                  <label className="block text-sm">
                    <span className="text-slate-600">Временный пароль</span>
                    <input
                      type="text"
                      name="password"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-black"
                      placeholder="Минимум 6 символов"
                    />
                    <span className="mt-1 block text-xs text-slate-500">
                      Поле используется только при выборе режима «Временный пароль».
                    </span>
                  </label>
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                  >
                    Создать пользователя
                  </button>
                </form>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-lg font-semibold text-slate-900">Сбросить пароль учителя</h2>
                <p className="text-sm text-slate-600">
                  Введите почту и новый временный пароль. После сохранения передайте его учителю.
                </p>
                <form action={resetTeacherPasswordAction} className="mt-4 space-y-3">
                  <label className="block text-sm">
                    <span className="text-slate-600">Email</span>
                    <input
                      type="email"
                      name="email"
                      required
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-black"
                      placeholder="teacher@example.com"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-600">Новый пароль</span>
                    <input
                      type="text"
                      name="newPassword"
                      minLength={6}
                      required
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-black"
                      placeholder="Минимум 6 символов"
                    />
                  </label>
                  <button
                    type="submit"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
                  >
                    Обновить пароль
                  </button>
                </form>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-900">Структура разделов</h2>
              <p className="text-sm text-slate-600">Этот список совпадает с левой колонкой в интерфейсе разделов.</p>
              {tree.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">Пока нет ни одного раздела.</p>
              ) : (
                <ul className="mt-4 space-y-2 text-black">{renderTree(tree)}</ul>
              )}
            </div>
          </section>
        </div>
      </main>
    );
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) {
      redirect('/login');
    }

    throw error;
  }
}
