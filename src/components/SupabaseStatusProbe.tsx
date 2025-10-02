import { useEffect, useState } from "react";

type ProbeState = "idle" | "loading" | "ok" | "error";

function normalizeUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

const HEALTH_PATH = "/auth/v1/health";

const STATUS_MESSAGES: Record<ProbeState, string> = {
  idle: "",
  loading: "Checking Supabase connectivity…",
  ok: "",
  error: "Unable to reach Supabase. Verify environment variables and network access.",
};

export default function SupabaseStatusProbe() {
  const [status, setStatus] = useState<ProbeState>("idle");

  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      setStatus("error");
      return;
    }

    let mounted = true;
    const controller = new AbortController();

    async function probe() {
      setStatus("loading");
      try {
        const response = await fetch(`${normalizeUrl(supabaseUrl)}${HEALTH_PATH}`, {
          method: "GET",
          mode: "cors",
          signal: controller.signal,
        });
        if (!mounted) {
          return;
        }
        setStatus(response.ok ? "ok" : "error");
      } catch (error) {
        if (!mounted) {
          return;
        }
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console -- surfaced for troubleshooting network issues locally
          console.error("SupabaseStatusProbe", error);
        }
        setStatus("error");
      }
    }

    void probe();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  if (status === "ok" || status === "idle") {
    return null;
  }

  return (
    <div role="status" className="w-full bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900">
      {STATUS_MESSAGES[status]}
    </div>
  );
}
