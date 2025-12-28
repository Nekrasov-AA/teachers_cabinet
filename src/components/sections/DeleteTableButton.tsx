'use client';

import { FormHTMLAttributes } from 'react';

type DeleteTableButtonProps = {
  action: FormHTMLAttributes<HTMLFormElement>['action'];
};

export default function DeleteTableButton({ action }: DeleteTableButtonProps) {
  const handleSubmit: FormHTMLAttributes<HTMLFormElement>['onSubmit'] = (event) => {
    const confirmed = window.confirm('Удалить таблицу? Все строки пропадут безвозвратно.');
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
        Удалить таблицу
      </button>
    </form>
  );
}
