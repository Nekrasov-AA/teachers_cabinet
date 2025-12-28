import { login, signup } from './actions';

type SearchParams = Record<string, string | string[] | undefined>;

type LoginPageProps = {
  searchParams?: Promise<SearchParams>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const errorParam = resolvedSearchParams.error;
  const error = Array.isArray(errorParam) ? errorParam[0] ?? null : errorParam ?? null;

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form action={login} className="w-full max-w-sm space-y-4 border rounded-lg p-6">
        <h1 className="text-xl font-semibold">Teachers Cabinet</h1>

        <label className="block">
          <span className="text-sm mb-1 block">Email</span>
          <input
            className="w-full border rounded px-3 py-2"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
        </label>

        <label className="block">
          <span className="text-sm mb-1 block">Password</span>
          <input
            className="w-full border rounded px-3 py-2"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex gap-2">
          <button type="submit" className="flex-1 border rounded px-3 py-2">
            Login
          </button>
          <button type="submit" formAction={signup} className="flex-1 border rounded px-3 py-2">
            Sign up
          </button>
        </div>
      </form>
    </main>
  );
}
