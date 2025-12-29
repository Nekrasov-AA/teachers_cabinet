'use server';

import { requireRole } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { parseRowFromFormData, formatErrors, type SchemaField } from '@/lib/tables/schemaForm';
import { logAuditEvent } from '@/lib/audit/log';

/**
 * Добавление строки через форму по schema
 */
export async function addRowFromSchemaAction(
  sectionId: string,
  tableId: string,
  schema: SchemaField[],
  formData: FormData
) {
  const { user } = await requireRole('admin');
  const supabase = await createClient();

  if (schema.length === 0) {
    throw new Error('Схема таблицы пуста');
  }

  const { row, errors } = parseRowFromFormData(schema, formData);

  if (errors.length > 0) {
    throw new Error(formatErrors(errors));
  }

  const { error } = await supabase.from('section_table_rows').insert({
    table_id: tableId,
    row,
  });

  if (error) {
    throw new Error(error.message);
  }

  await logAuditEvent({
    action: 'table.row.add',
    actorId: user.id,
    sectionId,
    tableId,
    metadata: { row },
  });
}

/**
 * Обновление строки через форму по schema
 */
export async function updateRowFromSchemaAction(
  sectionId: string,
  tableId: string,
  rowId: string,
  schema: SchemaField[],
  formData: FormData
) {
  const { user } = await requireRole('admin');
  const supabase = await createClient();

  if (schema.length === 0) {
    throw new Error('Схема таблицы пуста');
  }

  const { row, errors } = parseRowFromFormData(schema, formData);

  if (errors.length > 0) {
    throw new Error(formatErrors(errors));
  }

  const { error } = await supabase
    .from('section_table_rows')
    .update({ row })
    .eq('id', rowId)
    .eq('table_id', tableId);

  if (error) {
    throw new Error(error.message);
  }

  await logAuditEvent({
    action: 'table.row.update',
    actorId: user.id,
    sectionId,
    tableId,
    targetId: rowId,
    metadata: { row },
  });
}
