import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthError, requireRole } from '@/lib/auth/requireRole';

export async function DELETE(_request: Request, { params }: { params: { id: string; fileId: string } }) {
  try {
    await requireRole('admin');
    const supabase = await createClient();

    const { data: fileRecord, error } = await supabase
      .from('section_files')
      .select('id, path')
      .eq('id', params.fileId)
      .eq('section_id', params.id)
      .single();

    if (error || !fileRecord) {
      return NextResponse.json({ ok: false, message: 'File not found' }, { status: 404 });
    }

    const { error: deleteRowError } = await supabase.from('section_files').delete().eq('id', params.fileId);
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
