'use client';

import { FormEvent, useState } from 'react';

type ColumnType = 'string' | 'number' | 'boolean' | 'date';

type PreviewResult = {
  columns: { key: string; label: string; type: ColumnType }[];
  sampleRows: Record<string, unknown>[];
  totalRows: number;
};

type ExcelImportPreviewProps = {
  sectionId: string;
};

type PreviewSuccessResponse = {
  ok: true;
  columns: { key: string; label: string; type: ColumnType }[];
  sampleRows: Record<string, unknown>[];
  totalRows: number;
};

type PreviewErrorResponse = {
  ok: false;
  message?: string;
};

type PreviewApiResponse = PreviewSuccessResponse | PreviewErrorResponse;

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleString('ru-RU');
      }
    }
    return trimmed;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '—' : value.toLocaleString('ru-RU');
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[object]';
    }
  }

  return String(value);
}

export default function ExcelImportPreview({ sectionId }: ExcelImportPreviewProps) {
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastFileName, setLastFileName] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const fileInput = form.elements.namedItem('file') as HTMLInputElement | null;
    const file = fileInput?.files?.[0] ?? null;

    if (!file) {
      setStatus('error');
      setResult(null);
      setError('Выберите Excel файл');
      return;
    }

    setStatus('loading');
    setResult(null);

    const payload = new FormData();
    payload.append('file', file);

    try {
      const response = await fetch(`/api/sections/${sectionId}/tables/import/preview`, {
        method: 'POST',
        body: payload,
      });

      let data: PreviewApiResponse | null = null;
      try {
        data = (await response.json()) as PreviewApiResponse;
      } catch {
        data = null;
      }

      if (!response.ok || !data || data.ok !== true) {
        const message = !data || data.ok === false ? data?.message ?? 'Не удалось построить превью' : 'Не удалось построить превью';
        throw new Error(message);
      }

      setResult({
        columns: data.columns,
        sampleRows: data.sampleRows,
        totalRows: data.totalRows,
      });
      setLastFileName(file.name);
      setStatus('success');
      form.reset();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Не удалось построить превью';
      setError(message);
      setStatus('error');
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 md:flex-row md:items-end">
        <label className="flex-1 text-sm text-slate-600">
          Файл Excel (.xlsx)
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
              : 'bg-slate-900 hover:bg-slate-800'
          }`}
        >
          {status === 'loading' ? 'Обработка…' : 'Построить превью'}
        </button>
      </form>

      {lastFileName ? (
        <p className="text-xs text-slate-500">Последний файл: {lastFileName}</p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {error}
        </p>
      ) : null}

      {status === 'loading' ? (
        <p className="text-sm text-slate-500">Файл загружается…</p>
      ) : null}

      {result ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">
              Всего строк (без заголовка): <span className="font-semibold text-slate-900">{result.totalRows}</span>
            </p>
            <p className="text-xs text-slate-500">Данные никуда не сохраняются, это только предпросмотр.</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">Колонки ({result.columns.length})</p>
            {result.columns.length > 0 ? (
              <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-100 bg-white">
                {result.columns.map((column) => (
                  <li key={column.key} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-slate-900">{column.label}</span>
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                      {column.type} · {column.key}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Колонки не найдены.</p>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">Пример строк</p>
            {result.sampleRows.length > 0 ? (
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-slate-500">
                      {result.columns.map((column) => (
                        <th key={column.key} className="border-b border-slate-100 px-3 py-2">
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.sampleRows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="align-top">
                        {result.columns.map((column) => (
                          <td key={`${rowIndex}-${column.key}`} className="border-b border-slate-50 px-3 py-2 text-sm text-slate-800">
                            {formatValue(row[column.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Данных для превью нет.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
