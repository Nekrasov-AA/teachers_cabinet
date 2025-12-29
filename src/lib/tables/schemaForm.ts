/**
 * Утилита для парсинга FormData по schema и валидации типов
 */

export type ColumnType = 'string' | 'number' | 'boolean' | 'date';

export type SchemaField = {
  key: string;
  label: string;
  type: ColumnType;
};

export type ValidationError = {
  field: string;
  message: string;
};

export type ParseResult = {
  row: Record<string, unknown>;
  errors: ValidationError[];
};

/**
 * Приводит и валидирует значение по типу
 */
export function coerceAndValidateValue(
  type: ColumnType,
  raw: FormDataEntryValue | null,
  fieldLabel: string
): { value: unknown; error?: string } {
  // Пустое значение -> null для всех типов
  if (raw === null || (typeof raw === 'string' && raw.trim() === '')) {
    return { value: null };
  }

  // FormData File не поддерживается
  if (raw instanceof File) {
    return { value: null, error: `${fieldLabel}: файлы не поддерживаются` };
  }

  const stringValue = String(raw).trim();

  switch (type) {
    case 'boolean': {
      // checkbox: 'on' если checked, иначе undefined/null
      // Для явного управления используем raw === 'on' || raw === 'true'
      const boolValue = raw === 'on' || stringValue.toLowerCase() === 'true';
      return { value: boolValue };
    }

    case 'number': {
      const parsed = Number(stringValue);
      if (!Number.isFinite(parsed)) {
        return { value: null, error: `${fieldLabel}: некорректное число` };
      }
      return { value: parsed };
    }

    case 'date': {
      // Поддерживаем YYYY-MM-DD или ISO datetime
      const parsed = new Date(stringValue);
      if (Number.isNaN(parsed.getTime())) {
        return { value: null, error: `${fieldLabel}: некорректная дата` };
      }
      // Храним как ISO datetime для совместимости
      return { value: parsed.toISOString() };
    }

    case 'string':
    default: {
      // Текст без обработки
      return { value: stringValue };
    }
  }
}

/**
 * Парсит FormData в row объект по schema с валидацией
 */
export function parseRowFromFormData(schema: SchemaField[], formData: FormData): ParseResult {
  const row: Record<string, unknown> = {};
  const errors: ValidationError[] = [];

  for (const field of schema) {
    const raw = formData.get(field.key);
    const { value, error } = coerceAndValidateValue(field.type, raw, field.label);

    row[field.key] = value;

    if (error) {
      errors.push({ field: field.key, message: error });
    }
  }

  return { row, errors };
}

/**
 * Форматирует массив ошибок в единое сообщение
 */
export function formatErrors(errors: ValidationError[]): string {
  if (errors.length === 0) return '';
  return errors.map((e) => e.message).join('; ');
}
