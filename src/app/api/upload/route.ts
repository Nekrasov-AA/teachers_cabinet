import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthError, requireRole } from '@/lib/auth/requireRole';

export const runtime = 'nodejs'; // чтобы всё стабильно работало локально/на Vercel

// Ограничения для загрузок
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.txt', '.pdf', '.doc', '.docx'];

function validateFileSize(file: File): string | null {
  if (file.size === 0) {
    return 'Файл пуст';
  }
  if (file.size > MAX_FILE_SIZE) {
    return `Файл слишком большой. Максимум: ${MAX_FILE_SIZE / 1024 / 1024}MB`;
  }
  return null;
}

function validateFileExtension(fileName: string): string | null {
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `Недопустимое расширение файла. Допустимые: ${ALLOWED_EXTENSIONS.join(', ')}`;
  }
  return null;
}

export async function POST(req: Request) {
  try {
    await requireRole('admin');

    const form = await req.formData();
    const file = form.get('file');

    // Валидация: файл должен быть File
    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, message: 'Прикрепите файл с полем "file"' },
        { status: 400 }
      );
    }

    // Валидация: размер файла
    const sizeError = validateFileSize(file);
    if (sizeError) {
      return NextResponse.json(
        { ok: false, message: sizeError },
        { status: 400 }
      );
    }

    // Валидация: расширение файла
    const extError = validateFileExtension(file.name);
    if (extError) {
      return NextResponse.json(
        { ok: false, message: extError },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const path = `uploads/${Date.now()}_${safeName}`;

    const { data, error } = await supabase.storage
      .from('files')
      .upload(path, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (error) {
      return NextResponse.json(
        { ok: false, message: `Ошибка при загрузке: ${error.message}` },
        { status: 500 }
      );
    }

    const { data: publicUrl } = supabase.storage.from('files').getPublicUrl(data.path);

    return NextResponse.json({
      ok: true,
      bucket: 'files',
      path: data.path,
      url: publicUrl.publicUrl,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json(
        { ok: false, message: e.message },
        { status: e.status }
      );
    }

    const message = e instanceof Error ? e.message : 'Неизвестная ошибка при загрузке';
    console.error('[upload]', message, e);
    return NextResponse.json(
      { ok: false, message },
      { status: 500 }
    );
  }
}