import { createClient } from '@/lib/supabase/server';

export type AppRole = 'admin' | 'teacher';

export class AuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type RoleContext = {
  user: {
    id: string;
    email?: string;
  };
  role: AppRole;
  profile: {
    role: AppRole;
    full_name: string | null;
  };
};

export async function getUserWithRole(): Promise<RoleContext> {
  const supabase = await createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw new AuthError('Authentication required', 401);
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !profile) {
    throw new AuthError('Profile missing or inaccessible', 403);
  }

  const role = (profile.role ?? 'teacher') as AppRole;

  return {
    user: {
      id: userData.user.id,
      email: userData.user.email ?? undefined,
    },
    role,
    profile: {
      role,
      full_name: profile.full_name ?? null,
    },
  };
}

export async function requireRole(requiredRole: AppRole | AppRole[]) {
  const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  const context = await getUserWithRole();

  if (!allowed.includes(context.role)) {
    throw new AuthError('Forbidden', 403);
  }

  return context;
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}
