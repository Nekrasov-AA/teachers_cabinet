'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth/requireRole';

function normalizeEmail(value: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

async function upsertTeacherProfile(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
  fullName: string | null
) {
  const { error } = await adminClient.from('profiles').upsert(
    {
      id: userId,
      role: 'teacher',
      full_name: fullName,
    },
    { onConflict: 'id' }
  );

  if (error) {
    throw new Error(error.message);
  }
}

function redirectWithMessage(type: 'ok' | 'error', message: string) {
  const query = new URLSearchParams();
  if (type === 'ok') {
    query.set('userOk', message);
  } else {
    query.set('userError', message);
  }
  redirect(`/?${query.toString()}`);
}

export async function createTeacherAction(formData: FormData) {
  await requireRole('admin');

  const email = normalizeEmail(formData.get('email') as string | null);
  const fullName = ((formData.get('fullName') as string | null)?.trim() ?? '') || null;
  const mode = (formData.get('mode') as string | null) === 'password' ? 'password' : 'invite';
  const password = (formData.get('password') as string | null)?.trim() ?? '';

  if (!email) {
    redirectWithMessage('error', 'Укажите email');
  }

  if (mode === 'password' && password.length < 6) {
    redirectWithMessage('error', 'Пароль должен быть не короче 6 символов');
  }

  const adminClient = createAdminClient();

  try {
    let userId: string | null = null;

    if (mode === 'password') {
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: fullName ? { full_name: fullName } : undefined,
        app_metadata: { role: 'teacher' },
      });

      if (error) {
        throw new Error(error.message);
      }

      userId = data.user?.id ?? null;
    } else {
      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: fullName ?? undefined,
          role: 'teacher',
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      userId = data.user?.id ?? null;
    }

    if (userId) {
      await upsertTeacherProfile(adminClient, userId, fullName);
    }

    revalidatePath('/');
    const successMessage =
      mode === 'password'
        ? 'Учитель создан. Передайте временный пароль.'
        : 'Приглашение отправлено на указанную почту.';
    redirectWithMessage('ok', successMessage);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось создать пользователя';
    redirectWithMessage('error', message);
  }
}

async function findUserIdByEmail(
  adminClient: ReturnType<typeof createAdminClient>,
  email: string
) {
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw new Error(error.message);
    }

    const users = data?.users ?? [];
    const match = users.find((user) => user.email?.toLowerCase() === email);

    if (match) {
      return match.id;
    }

    if (!data?.nextPage || data.nextPage === page) {
      break;
    }

    page = data.nextPage;
  }

  return null;
}

export async function resetTeacherPasswordAction(formData: FormData) {
  await requireRole('admin');

  const email = normalizeEmail(formData.get('email') as string | null);
  const newPassword = (formData.get('newPassword') as string | null)?.trim() ?? '';

  if (!email) {
    redirectWithMessage('error', 'Укажите email для сброса');
  }

  if (newPassword.length < 6) {
    redirectWithMessage('error', 'Новый пароль должен быть не короче 6 символов');
  }

  try {
    const adminClient = createAdminClient();
    const userId = await findUserIdByEmail(adminClient, email);

    if (!userId) {
      throw new Error('Пользователь с таким email не найден');
    }

    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      password: newPassword,
      email_confirm: true,
      app_metadata: { role: 'teacher' },
    });

    if (error) {
      throw new Error(error.message);
    }

    await upsertTeacherProfile(adminClient, userId, null);

    revalidatePath('/');
    redirectWithMessage('ok', 'Пароль обновлён. Передайте его учителю.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось обновить пароль';
    redirectWithMessage('error', message);
  }
}
