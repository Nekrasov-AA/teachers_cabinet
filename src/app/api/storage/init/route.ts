import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = createAdminClient();

    // 1) Получаем список бакетов
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      return NextResponse.json(
        { ok: false, where: 'storage.listBuckets', message: listError.message },
        { status: 500 }
      );
    }

    const exists = (buckets ?? []).some((b) => b.name === 'files');

    // 2) Если бакета нет — создаём
    if (!exists) {
      const { error: createError } = await supabase.storage.createBucket('files', {
        public: true,
      });

      if (createError) {
        return NextResponse.json(
          { ok: false, where: 'storage.createBucket', message: createError.message },
          { status: 500 }
        );
      }
    }

    // 3) Возвращаем итоговый список бакетов
    const { data: bucketsAfter, error: listAfterError } = await supabase.storage.listBuckets();
    if (listAfterError) {
      return NextResponse.json(
        { ok: false, where: 'storage.listBuckets(after)', message: listAfterError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      created: !exists,
      buckets: (bucketsAfter ?? []).map((b) => ({ name: b.name, public: b.public })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ ok: false, where: 'api', message }, { status: 500 });
  }
}