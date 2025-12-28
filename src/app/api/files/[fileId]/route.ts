import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthError, getUserWithRole } from '@/lib/auth/requireRole';

const SIGNED_URL_TTL_SECONDS = 60;

type ParamsPromise = Promise<{ fileId: string }>;

export async function GET(_request: Request, { params }: { params: ParamsPromise }) {
  try {
    await getUserWithRole();
    const { fileId } = await params;

    const supabase = await createClient();
    const { data: fileRecord, error } = await supabase
      .from('section_files')
      .select('path, original_name')
      .eq('id', fileId)
      .single();

    if (error || !fileRecord) {
      return NextResponse.json({ ok: false, message: 'Файл не найден' }, { status: 404 });
    }

    const adminClient = createAdminClient();
    const { data: signed, error: signedError } = await adminClient.storage
      .from('files')
      .createSignedUrl(fileRecord.path, SIGNED_URL_TTL_SECONDS);

    if (signedError || !signed?.signedUrl) {
      throw new Error(signedError?.message ?? 'Не удалось получить ссылку');
    }

    return NextResponse.redirect(signed.signedUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    const status = error instanceof AuthError ? error.status : 500;
    return NextResponse.json({ ok: false, message }, { status });
  }
}
