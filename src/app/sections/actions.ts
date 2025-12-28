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
