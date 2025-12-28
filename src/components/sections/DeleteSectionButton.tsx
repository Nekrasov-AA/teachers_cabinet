'use client';

import { FormHTMLAttributes } from 'react';

type DeleteSectionButtonProps = {
  action: FormHTMLAttributes<HTMLFormElement>['action'];
};

export default function DeleteSectionButton({ action }: DeleteSectionButtonProps) {
  const handleSubmit: FormHTMLAttributes<HTMLFormElement>['onSubmit'] = (event) => {
    const confirmed = window.confirm('Удалить раздел? Все таблицы и файлы будут удалены безвозвратно.');
    if (!confirmed) {
      event.preventDefault();
    }
  };

  return (
    <form action={action} onSubmit={handleSubmit} className="mt-4">
      <button
        type="submit"
        className="rounded-lg border border-rose-200 bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
      >
        Удалить раздел
      </button>
    </form>
  );
}
