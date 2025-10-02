import { lazy, ReactNode, Suspense } from "react";

const REQUIRED_ENV = [
  { key: "VITE_SUPABASE_URL", label: "VITE_SUPABASE_URL" },
  { key: "VITE_SUPABASE_ANON_KEY", label: "VITE_SUPABASE_ANON_KEY" },
] as const;

type RequiredEnvKey = typeof REQUIRED_ENV[number]["key"];

const SupabaseStatusProbe = lazy(() => import("./SupabaseStatusProbe"));

interface EnvironmentGateProps {
  children: ReactNode;
}

function MissingEnvNotice({ missing }: { missing: RequiredEnvKey[] }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold">Missing configuration</h1>
        <p className="text-sm text-slate-200">
          The frontend cannot start because required environment variables are undefined. Add them in your deployment settings (e.g. Vercel project → Environment Variables) and redeploy.
        </p>
        <ul className="mx-auto w-full max-w-sm list-disc space-y-1 text-left text-sm text-slate-200">
          {missing.map((item) => (
            <li key={item}>
              <code className="rounded bg-slate-900 px-2 py-1 text-xs text-sky-300">{item}</code>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-400">
          Tip: Update your <code>.env.local</code> for local runs and the Vercel dashboard for production builds. Frontend environment values are baked in at build time, so redeploy after updating them.
        </p>
      </div>
    </div>
  );
}

function readEnvValue(key: RequiredEnvKey): string {
  const value = import.meta.env[key];
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

export function EnvironmentGate({ children }: EnvironmentGateProps) {
  const missingKeys = REQUIRED_ENV.filter(({ key }) => !readEnvValue(key)).map(({ key }) => key);

  if (missingKeys.length > 0) {
    return <MissingEnvNotice missing={missingKeys} />;
  }

  return (
    <>
      <Suspense fallback={null}>
        <SupabaseStatusProbe />
      </Suspense>
      {children}
    </>
  );
}
