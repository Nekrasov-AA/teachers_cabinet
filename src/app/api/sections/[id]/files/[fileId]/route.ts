import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthError, requireRole } from '@/lib/auth/requireRole';

type ParamsPromise = Promise<{ id: string; fileId: string }>;

export async function DELETE(_request: Request, { params }: { params: ParamsPromise }) {
  try {
    await requireRole('admin');
    const supabase = await createClient();
    const { id, fileId } = await params;

    const { data: fileRecord, error } = await supabase
      .from('section_files')
      .select('id, path')
      .eq('id', fileId)
      .eq('section_id', id)
      .single();

    if (error || !fileRecord) {
      return NextResponse.json({ ok: false, message: 'File not found' }, { status: 404 });
    }

    const { error: deleteRowError } = await supabase.from('section_files').delete().eq('id', fileId);
    if (deleteRowError) {
      throw new Error(deleteRowError.message);
    }

    const adminClient = createAdminClient();
    await adminClient.storage.from('files').remove([fileRecord.path]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = error instanceof AuthError ? error.status : 500;
    return NextResponse.json({ ok: false, message }, { status });
  }
}
