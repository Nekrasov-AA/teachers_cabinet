'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type ImportSuccessResponse = {
  ok: true;
  tableId: string;
  importedRows: number;
  importedColumns: number;
};

type ImportErrorResponse = {
  ok: false;
  message?: string;
};

type ImportApiResponse = ImportSuccessResponse | ImportErrorResponse;

type ExcelImportFormProps = {
  sectionId: string;
};

export default function ExcelImportForm({ sectionId }: ExcelImportFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'loading'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const fileInput = form.elements.namedItem('file') as HTMLInputElement | null;
    const file = fileInput?.files?.[0] ?? null;

    if (!file) {
      setError('Выберите Excel файл для импорта');
      return;
    }

    setStatus('loading');

    const payload = new FormData();
    payload.append('file', file);

    try {
      const response = await fetch(`/api/sections/${sectionId}/tables/import`, {
        method: 'POST',
        body: payload,
      });

      let data: ImportApiResponse | null = null;
      try {
        data = (await response.json()) as ImportApiResponse;
      } catch {
        data = null;
      }

      if (!response.ok || !data || data.ok !== true) {
        const message = !data?.ok ? data?.message ?? 'Импорт завершился ошибкой' : 'Импорт завершился ошибкой';
        throw new Error(message);
      }

      setStatus('idle');
      form.reset();
      const successQuery = new URLSearchParams();
      successQuery.set('ok', `Импорт завершен (${data.importedRows} строк)`);
      router.push(`/sections/${sectionId}/tables/${data.tableId}?${successQuery.toString()}`);
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : 'Импорт завершился ошибкой';
      setError(message);
      setStatus('idle');
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 md:flex-row md:items-end">
        <label className="flex-1 text-sm text-slate-600">
          Excel файл (до 10MB)
          <input
            type="file"
            name="file"
            accept=".xlsx,.xls"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={status === 'loading'}
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
            status === 'loading'
              ? 'cursor-not-allowed bg-slate-400'
              : 'bg-emerald-600 hover:bg-emerald-500'
          }`}
        >
          {status === 'loading' ? 'Импортируем…' : 'Импортировать'}
        </button>
      </form>

      <p className="text-xs text-slate-500">
        Лимиты: размер до 10MB и до 2000 строк. Таблица создаётся автоматически, данные сохраняются сразу.
      </p>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {error}
        </p>
      ) : null}
    </div>
  );
}
