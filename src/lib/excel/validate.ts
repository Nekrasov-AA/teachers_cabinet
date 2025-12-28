import type { ParsedColumn } from './parse';

/**
 * Валидирует имена колонок и убеждается что они уникальны
 */
export function validateColumns(columns: ParsedColumn[]): string | null {
  if (columns.length === 0) {
    return 'Нет колонок для импорта';
  }

  if (columns.length > 100) {
    return 'Слишком много колонок (максимум 100)';
  }

  // Проверяем что ключи уникальны
  const keys = new Set<string>();
  for (const col of columns) {
    if (keys.has(col.key)) {
      return `Дублирующийся ключ колонки: ${col.key}`;
    }
    keys.add(col.key);
  }

  // Проверяем что метки не пусты
  for (const col of columns) {
    if (!col.label || col.label.trim().length === 0) {
      return 'Найдена пустая метка колонки';
    }
  }

  return null;
}

/**
 * Валидирует значения в строке против типов колонок
 */
export function validateRowValue(
  value: unknown,
  columnType: ParsedColumn['type']
): { valid: boolean; error?: string } {
  // null/undefined допускается для всех типов
  if (value === null || value === undefined) {
    return { valid: true };
  }

  switch (columnType) {
    case 'string': {
      if (typeof value === 'string') {
        // Ограничение на длину строки (30000 символов)
        if (value.length > 30000) {
          return { valid: false, error: 'Значение слишком длинное (макс 30000 символов)' };
        }
        return { valid: true };
      }
      return { valid: false, error: `Ожидается строка, получено ${typeof value}` };
    }

    case 'number': {
      if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
          return { valid: false, error: 'Число должно быть конечным' };
        }
        return { valid: true };
      }
      return { valid: false, error: `Ожидается число, получено ${typeof value}` };
    }

    case 'boolean': {
      if (typeof value === 'boolean') {
        return { valid: true };
      }
      return { valid: false, error: `Ожидается логическое значение, получено ${typeof value}` };
    }

    case 'date': {
      if (typeof value === 'string') {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          return { valid: false, error: 'Некорректный формат даты' };
        }
        return { valid: true };
      }
      return { valid: false, error: `Ожидается строка даты, получено ${typeof value}` };
    }

    default: {
      const exhaustive: never = columnType;
      return { valid: false, error: `Неизвестный тип: ${exhaustive}` };
    }
  }
}

/**
 * Валидирует всю строку
 */
export function validateRow(
  row: Record<string, unknown>,
  columns: ParsedColumn[],
  rowNumber: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const column of columns) {
    const value = row[column.key];
    const validation = validateRowValue(value, column.type);

    if (!validation.valid && validation.error) {
      errors.push(`Колонка "${column.label}" (строка ${rowNumber}): ${validation.error}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.slice(0, 10), // Лимит на 10 ошибок на строку для читаемости
  };
}

/**
 * Валидирует набор строк, возвращает первые найденные ошибки
 */
export function validateRows(
  rows: Record<string, unknown>[],
  columns: ParsedColumn[],
  maxErrors = 3
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (let i = 0; i < rows.length && errors.length < maxErrors; i++) {
    const row = rows[i];
    const rowValidation = validateRow(row, columns, i + 2); // +2 потому что строка 1 это headers

    if (!rowValidation.valid) {
      errors.push(...rowValidation.errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
