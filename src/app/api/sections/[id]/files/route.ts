import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthError, getUserWithRole, requireRole } from '@/lib/auth/requireRole';

type ParamsPromise = Promise<{ id: string }>;

function sanitizeName(name: string) {
  return name.replace(/[^\w.\-]+/g, '_');
}

export async function GET(_request: Request, { params }: { params: ParamsPromise }) {
  try {
    await getUserWithRole();
    const { id } = await params;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('section_files')
      .select('id, section_id, path, original_name, mime_type, size, created_at, uploaded_by')
      .eq('section_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, files: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = error instanceof AuthError ? error.status : 500;
    return NextResponse.json({ ok: false, message }, { status });
  }
}

export async function POST(request: Request, { params }: { params: ParamsPromise }) {
  try {
    const { user } = await requireRole('admin');
    const { id } = await params;
    const supabase = await createClient();
    const form = await request.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: 'Expected multipart/form-data with "file"' }, { status: 400 });
    }

    const { data: section, error: sectionError } = await supabase
      .from('sections')
      .select('id')
      .eq('id', id)
      .single();

    if (sectionError || !section) {
      return NextResponse.json({ ok: false, message: 'Section not found' }, { status: 404 });
    }

    const adminClient = createAdminClient();
    const safeName = sanitizeName(file.name || 'file');
    const path = `sections/${id}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await adminClient.storage
      .from('files')
      .upload(path, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data, error } = await supabase
      .from('section_files')
      .insert({
        section_id: id,
        path,
        original_name: file.name,
        mime_type: file.type,
        size: file.size,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (error) {
      await adminClient.storage.from('files').remove([path]);
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, file: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = error instanceof AuthError ? error.status : 500;
    return NextResponse.json({ ok: false, message }, { status });
  }
}
