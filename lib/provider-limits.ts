import "server-only";

const MGMT_URL = "http://127.0.0.1:8317/v8/management/credentials";

export type LimitWindow = { name: string; used: number; resetAt: number };
export type ProviderLimit = { provider: string; windows: LimitWindow[] };
export type ProviderLimits = { ok: true; limits: ProviderLimit[] } | { ok: false };

type Credential = {
  provider: string;
  quota?: { signals?: Record<string, string> };
  model_quotas?: Record<string, { observed_at: string; signals: Record<string, string> }>;
};

// Nur das Signalformat, das der Proxy nachweislich liefert (Claude: Anthropic-Ratelimit-Unified-*).
// Codex/Antigravity: keine Signale = leere Liste = „keine Daten“. Nichts geraten.
function windowsOf(c: Credential): LimitWindow[] {
  const newest = Object.values(c.model_quotas ?? {}).sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0];
  const s = newest?.signals ?? c.quota?.signals ?? {};
  return (["5h", "7d"] as const).flatMap((w) => {
    const used = Number(s[`Anthropic-Ratelimit-Unified-${w}-Utilization`]);
    const reset = Number(s[`Anthropic-Ratelimit-Unified-${w}-Reset`]);
    return Number.isFinite(used) && Number.isFinite(reset) && s[`Anthropic-Ratelimit-Unified-${w}-Utilization`] !== undefined
      ? [{ name: w, used, resetAt: reset * 1000 }]
      : [];
  });
}

let cache: { at: number; value: ProviderLimits } | undefined;

// Management-Key bleibt serverseitig. Cache 60 s; Fehler werden nicht gecacht.
export async function getProviderLimits(): Promise<ProviderLimits> {
  if (cache && Date.now() - cache.at < 60_000) return cache.value;
  try {
    const res = await fetch(MGMT_URL, {
      headers: { Authorization: `Bearer ${process.env.CLI_PROXY_MANAGEMENT_KEY}` },
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false };
    const { files } = (await res.json()) as { files: Credential[] };
    const byProvider = new Map<string, LimitWindow[]>();
    for (const c of files) if (!byProvider.get(c.provider)?.length) byProvider.set(c.provider, windowsOf(c));
    const value: ProviderLimits = {
      ok: true,
      limits: [...byProvider].map(([provider, windows]) => ({ provider, windows })),
    };
    cache = { at: Date.now(), value };
    return value;
  } catch {
    return { ok: false };
  }
}
