'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth/requireRole';

function sanitizeOrderIndex(value: FormDataEntryValue | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, '_');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function revalidateSections(sectionId?: string | null) {
  revalidatePath('/', 'page');
  revalidatePath('/sections');
  if (sectionId) {
    revalidatePath(`/sections/${sectionId}`);
  }
}

export async function createSectionAction(formData: FormData) {
  await requireRole('admin');

  const title = (formData.get('title') as string | null)?.trim();
  const parentId = (formData.get('parentId') as string | null) || null;
  const orderIndex = sanitizeOrderIndex(formData.get('orderIndex'));

  if (!title) {
    throw new Error('Название обязательно');
  }

  const supabase = await createClient();
  const { error } = await supabase.from('sections').insert({
    title,
    parent_id: parentId,
    order_index: orderIndex,
  });

  if (error) {
    throw new Error(error.message);
  }

  await revalidateSections(parentId);
}

export async function uploadSectionFileAction(sectionId: string, formData: FormData) {
  const { user } = await requireRole('admin');
  const supabase = await createClient();

  const file = formData.get('file');
  if (!(file instanceof File)) {
    throw new Error('Прикрепите файл');
  }

  const { data: section, error: sectionError } = await supabase
    .from('sections')
    .select('id')
    .eq('id', sectionId)
    .single();

  if (sectionError || !section) {
    throw new Error('Раздел не найден');
  }

  const adminClient = createAdminClient();
  const safeName = safeFileName(file.name || 'file');
  const path = `sections/${sectionId}/${Date.now()}_${safeName}`;

  const { error: uploadError } = await adminClient.storage
    .from('files')
    .upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { error: insertError } = await supabase.from('section_files').insert({
    section_id: sectionId,
    path,
    original_name: file.name,
    mime_type: file.type,
    size: file.size,
    uploaded_by: user.id,
  });

  if (insertError) {
    await adminClient.storage.from('files').remove([path]);
    throw new Error(insertError.message);
  }

  await revalidateSections(sectionId);
}

export async function deleteSectionFileAction(sectionId: string, formData: FormData) {
  await requireRole('admin');
  const supabase = await createClient();

  const fileId = (formData.get('fileId') as string | null)?.trim();
  if (!fileId) {
    throw new Error('Неизвестный файл');
  }

  const { data: fileRecord, error } = await supabase
    .from('section_files')
    .select('id, path')
    .eq('id', fileId)
    .eq('section_id', sectionId)
    .single();

  if (error || !fileRecord) {
    throw new Error('Файл не найден');
  }

  const { error: deleteRowError } = await supabase.from('section_files').delete().eq('id', fileId);
  if (deleteRowError) {
    throw new Error(deleteRowError.message);
  }

  const adminClient = createAdminClient();
  await adminClient.storage.from('files').remove([fileRecord.path]);

  await revalidateSections(sectionId);
}

export async function createTableAction(sectionId: string, title: string) {
  const { user } = await requireRole('admin');
  const normalizedTitle = title?.trim();

  if (!normalizedTitle) {
    throw new Error('Название таблицы обязательно');
  }

  const supabase = await createClient();
  const { error } = await supabase.from('section_tables').insert({
    section_id: sectionId,
    title: normalizedTitle,
    schema: [],
    created_by: user.id,
  });

  if (error) {
    throw new Error(error.message);
  }

  await revalidateSections(sectionId);
}

export async function addRowAction(tableId: string, row: Record<string, unknown>) {
  const { user } = await requireRole('admin');

  if (!isPlainObject(row)) {
    throw new Error('Строка должна быть объектом');
  }

  const supabase = await createClient();
  const { data: table, error: tableError } = await supabase
    .from('section_tables')
    .select('section_id')
    .eq('id', tableId)
    .single();

  if (tableError || !table) {
    throw new Error('Таблица не найдена');
  }

  const { error } = await supabase.from('section_table_rows').insert({
    table_id: tableId,
    row,
    created_by: user.id,
  });

  if (error) {
    throw new Error(error.message);
  }

  await revalidateSections(table.section_id);
}

export async function deleteRowAction(sectionId: string, tableId: string, rowId: string) {
  await requireRole('admin');
  const supabase = await createClient();

  const normalizedRowId = rowId?.trim();
  if (!normalizedRowId) {
    throw new Error('Неизвестная строка');
  }

  const { data: table, error: tableError } = await supabase
    .from('section_tables')
    .select('section_id')
    .eq('id', tableId)
    .single();

  if (tableError || !table) {
    throw new Error('Таблица не найдена');
  }

  if (table.section_id !== sectionId) {
    throw new Error('Таблица принадлежит другому разделу');
  }

  const { data: rowRecord, error: rowError } = await supabase
    .from('section_table_rows')
    .select('id')
    .eq('id', normalizedRowId)
    .eq('table_id', tableId)
    .single();

  if (rowError || !rowRecord) {
    throw new Error('Строка не найдена');
  }

  const { error: deleteError } = await supabase
    .from('section_table_rows')
    .delete()
    .eq('id', normalizedRowId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  await revalidateSections(sectionId);
  revalidatePath(`/sections/${sectionId}/tables/${tableId}`);
}

export async function deleteSectionAction(sectionId: string) {
  await requireRole('admin');
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: section, error: sectionError } = await supabase
    .from('sections')
    .select('id, parent_id')
    .eq('id', sectionId)
    .single();

  if (sectionError || !section) {
    throw new Error('Раздел не найден');
  }

  const { data: tables, error: tablesError } = await supabase
    .from('section_tables')
    .select('id')
    .eq('section_id', sectionId);

  if (tablesError) {
    throw new Error(tablesError.message);
  }

  const tableIds = tables?.map((table) => table.id) ?? [];

  if (tableIds.length > 0) {
    const { error: rowsDeleteError } = await supabase
      .from('section_table_rows')
      .delete()
      .in('table_id', tableIds);

    if (rowsDeleteError) {
      throw new Error(rowsDeleteError.message);
    }

    const { error: deleteTablesError } = await supabase
      .from('section_tables')
      .delete()
      .in('id', tableIds);

    if (deleteTablesError) {
      throw new Error(deleteTablesError.message);
    }
  }

  const { data: fileRecords, error: filesError } = await supabase
    .from('section_files')
    .select('path')
    .eq('section_id', sectionId);

  if (filesError) {
    throw new Error(filesError.message);
  }

  if (fileRecords && fileRecords.length > 0) {
    const { error: deleteFilesError } = await supabase
      .from('section_files')
      .delete()
      .eq('section_id', sectionId);

    if (deleteFilesError) {
      throw new Error(deleteFilesError.message);
    }

    const paths = fileRecords.map((file) => file.path).filter(Boolean);
    if (paths.length > 0) {
      await adminClient.storage.from('files').remove(paths);
    }
  }

  const { error: deleteSectionError } = await supabase.from('sections').delete().eq('id', sectionId);

  if (deleteSectionError) {
    throw new Error(deleteSectionError.message);
  }

  await revalidateSections(section.parent_id);
}

export async function deleteTableAction(sectionId: string, tableId: string) {
  await requireRole('admin');
  const supabase = await createClient();

  const { data: tableRecord, error: tableError } = await supabase
    .from('section_tables')
    .select('section_id')
    .eq('id', tableId)
    .single();

  if (tableError || !tableRecord) {
    throw new Error('Таблица не найдена');
  }

  if (tableRecord.section_id !== sectionId) {
    throw new Error('Таблица принадлежит другому разделу');
  }

  const { error: deleteError } = await supabase
    .from('section_tables')
    .delete()
    .eq('id', tableId)
    .eq('section_id', sectionId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  await revalidateSections(sectionId);
  revalidatePath(`/sections/${sectionId}/tables/${tableId}`);
}

type TableSchemaColumn = {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date';
};

const allowedColumnTypes = new Set<TableSchemaColumn['type']>(['string', 'number', 'boolean', 'date']);

export async function updateTableSchemaAction(
  sectionId: string,
  tableId: string,
  schemaJson: string
) {
  await requireRole('admin');

  let parsed: unknown;
  try {
    parsed = JSON.parse(schemaJson);
  } catch {
    throw new Error('Некорректный JSON схемы');
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Добавьте хотя бы одну колонку');
  }

  const normalized: TableSchemaColumn[] = [];
  const seenKeys = new Set<string>();

  parsed.forEach((field) => {
    if (!isPlainObject(field)) {
      throw new Error('Каждая колонка должна быть объектом');
    }

    const key = typeof field.key === 'string' ? field.key.trim() : '';
    const label = typeof field.label === 'string' ? field.label.trim() : '';
    const rawType = typeof field.type === 'string' ? (field.type.trim() as TableSchemaColumn['type']) : 'string';
    const type = allowedColumnTypes.has(rawType) ? rawType : 'string';

    if (!key) {
      throw new Error('Укажите ключ колонки');
    }

    if (seenKeys.has(key)) {
      throw new Error(`Ключ "${key}" повторяется`);
    }

    normalized.push({
      key,
      label: label || key,
      type,
    });
    seenKeys.add(key);
  });

  const supabase = await createClient();
  const { data: tableRecord, error: tableError } = await supabase
    .from('section_tables')
    .select('section_id')
    .eq('id', tableId)
    .single();

  if (tableError || !tableRecord) {
    throw new Error('Таблица не найдена');
  }

  if (tableRecord.section_id !== sectionId) {
    throw new Error('Таблица принадлежит другому разделу');
  }

  const { error: updateError } = await supabase
    .from('section_tables')
    .update({ schema: normalized })
    .eq('id', tableId)
    .eq('section_id', sectionId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await revalidateSections(sectionId);
  revalidatePath(`/sections/${sectionId}/tables/${tableId}`);
}
