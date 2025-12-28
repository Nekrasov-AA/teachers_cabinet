import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthError, requireRole } from '@/lib/auth/requireRole';

export const runtime = 'nodejs'; // чтобы всё стабильно работало локально/на Vercel

export async function POST(req: Request) {
  try {
    await requireRole('admin');

    const form = await req.formData();
    const file = form.get('file');

    // formData().get('file') должен быть File
    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, message: 'Expected multipart/form-data with field "file"' },
        { status: 400 }
      );
    }

    // (MVP) просто складываем в bucket files
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
        { ok: false, where: 'storage.upload', message: error.message },
        { status: 500 }
      );
    }

    // Bucket public => можем отдать public url
    const { data: publicUrl } = supabase.storage.from('files').getPublicUrl(data.path);

    return NextResponse.json({
      ok: true,
      bucket: 'files',
      path: data.path,
      url: publicUrl.publicUrl,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ ok: false, message: e.message }, { status: e.status });
    }

    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}