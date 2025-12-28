'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type ColumnType = 'string' | 'number' | 'boolean' | 'date';

type Column = {
  key: string;
  label: string;
  type: ColumnType;
};

type SchemaEditorProps = {
  initialColumns: Column[];
  saveAction: (formData: FormData) => Promise<void>;
};

const columnTypeOptions: { value: ColumnType; label: string }[] = [
  { value: 'string', label: 'Строка' },
  { value: 'number', label: 'Число' },
  { value: 'boolean', label: 'Логический' },
  { value: 'date', label: 'Дата' },
];

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-\u0400-\u04FF]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
}

export default function SchemaEditor({ initialColumns, saveAction }: SchemaEditorProps) {
  const [columns, setColumns] = useState<Column[]>(initialColumns);
  const [label, setLabel] = useState('');
  const [type, setType] = useState<ColumnType>('string');

  useEffect(() => {
    setColumns(initialColumns);
  }, [initialColumns]);

  const schemaJson = useMemo(() => JSON.stringify(columns), [columns]);
  const canSave = columns.length > 0;

  const handleAddColumn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      return;
    }

    const baseKey = slugify(trimmedLabel) || `column_${columns.length + 1}`;
    let nextKey = baseKey;
    let attempt = 2;
    while (columns.some((column) => column.key === nextKey)) {
      nextKey = `${baseKey}_${attempt}`;
      attempt += 1;
    }

    setColumns((prev) => [...prev, { key: nextKey, label: trimmedLabel, type }]);
    setLabel('');
    setType('string');
  };

  const removeColumn = (key: string) => {
    setColumns((prev) => prev.filter((column) => column.key !== key));
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleAddColumn} className="flex flex-col gap-3 md:flex-row md:items-end">
        <label className="flex-1 text-sm text-slate-600">
          Название столбца
          <input
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="ФИО"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
          />
        </label>
        <label className="text-sm text-slate-600">
          Тип
          <select
            value={type}
            onChange={(event) => setType(event.target.value as ColumnType)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
          >
            {columnTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Добавить колонку
        </button>
      </form>

      {columns.length > 0 ? (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100 bg-white">
          {columns.map((column) => (
            <li key={column.key} className="flex items-center justify-between px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-slate-900">{column.label}</p>
                <p className="text-xs text-slate-500">key: {column.key} · тип: {column.type}</p>
              </div>
              <button
                type="button"
                onClick={() => removeColumn(column.key)}
                className="text-xs font-medium text-rose-600 hover:text-rose-500"
              >
                Удалить
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">Добавьте хотя бы одну колонку.</p>
      )}

      <form action={saveAction} className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <input type="hidden" name="schema_json" value={schemaJson} />
        <p className="text-xs text-slate-500">Всего колонок: {columns.length}</p>
        <button
          type="submit"
          disabled={!canSave}
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
            canSave ? 'bg-indigo-600 hover:bg-indigo-500' : 'cursor-not-allowed bg-slate-300'
          }`}
        >
          Сохранить схему
        </button>
      </form>
    </div>
  );
}
