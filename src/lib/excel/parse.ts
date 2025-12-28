import { Buffer } from 'node:buffer';
import { read, utils } from 'xlsx';
import type { WorkBook } from 'xlsx';

export type ColumnType = 'string' | 'number' | 'boolean' | 'date';

export type ParsedColumn = {
  key: string;
  label: string;
  type: ColumnType;
};

export type ParsedExcelData = {
  columns: ParsedColumn[];
  rows: Record<string, unknown>[];
  totalRows: number;
};

export type ParseExcelOptions = {
  maxRows?: number;
};

export class ExcelParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExcelParseError';
  }
}

function slugifyKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-\u0400-\u04FF]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
}

function isBlankValue(value: unknown) {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === 'string') {
    return value.trim().length === 0;
  }

  return false;
}

function inferValueType(value: unknown): ColumnType | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return 'date';
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return 'number';
  }

  if (typeof value === 'boolean') {
    return 'boolean';
  }

  if (typeof value === 'string') {
    return value.trim().length > 0 ? 'string' : null;
  }

  return 'string';
}

function inferColumnType(values: unknown[]): ColumnType {
  let resolved: ColumnType | null = null;

  for (const value of values) {
    const valueType = inferValueType(value);
    if (!valueType) {
      continue;
    }

    if (!resolved) {
      resolved = valueType;
      continue;
    }

    if (resolved !== valueType) {
      return 'string';
    }
  }

  return resolved ?? 'string';
}

function normalizeCellValue(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function ensureBuffer(input: ArrayBuffer | Buffer) {
  return input instanceof Buffer ? input : Buffer.from(new Uint8Array(input));
}

export function parseExcelBuffer(
  input: ArrayBuffer | Buffer,
  options: ParseExcelOptions = {}
): ParsedExcelData {
  const payload = ensureBuffer(input);
  let workbook: WorkBook;

  try {
    workbook = read(payload, { type: 'buffer', cellDates: true });
  } catch {
    throw new ExcelParseError('Не удалось прочитать файл');
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new ExcelParseError('В книге нет листов');
  }

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new ExcelParseError('Не удалось получить лист');
  }

  const rawRows = utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  }) as unknown[][];

  if (!rawRows.length) {
    throw new ExcelParseError('Лист пуст');
  }

  const headerRow = rawRows[0] ?? [];
  if (!headerRow.length || headerRow.every(isBlankValue)) {
    throw new ExcelParseError('Не найдена строка заголовков');
  }

  const dataRows = rawRows.slice(1);
  const meaningfulRows = dataRows.filter((row) => row.some((value) => !isBlankValue(value)));
  const totalRows = meaningfulRows.length;
  const maxRows = options.maxRows ?? Infinity;

  if (totalRows === 0) {
    throw new ExcelParseError('Нет данных для импорта');
  }

  if (totalRows > maxRows) {
    throw new ExcelParseError(`Превышен лимит строк (${maxRows})`);
  }

  const maxColumns = Math.max(
    headerRow.length,
    meaningfulRows.reduce((acc, row) => Math.max(acc, row.length), 0)
  );

  const usedKeys = new Set<string>();
  const columns: ParsedColumn[] = [];

  for (let index = 0; index < maxColumns; index += 1) {
    const cell = headerRow[index];
    const rawLabel = cell === null || cell === undefined ? '' : String(cell).trim();
    const label = rawLabel || `Колонка ${index + 1}`;
    const baseKey = slugifyKey(label) || `column_${index + 1}`;
    let key = baseKey;
    let suffix = 2;

    while (usedKeys.has(key)) {
      key = `${baseKey}_${suffix}`;
      suffix += 1;
    }

    usedKeys.add(key);

    const columnValues = meaningfulRows.map((row) => row[index]);
    const type = inferColumnType(columnValues);

    columns.push({ label, key, type });
  }

  const normalizedRows = meaningfulRows.map((row) => {
    const shaped: Record<string, unknown> = {};
    columns.forEach((column, index) => {
      shaped[column.key] = normalizeCellValue(row[index]);
    });
    return shaped;
  });

  return {
    columns,
    rows: normalizedRows,
    totalRows,
  };
}
