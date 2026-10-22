/**
 * An OPT-IN alternative to `open-er-api-rates-client.ts` for the sweep's fallback leg: a GET against
 * AllRatesToday (https://allratestoday.com), used ONLY when the operator sets
 * `ALLRATESTODAY_API_KEY`. Unset (the default), nothing here is ever called and the sweep behaves
 * exactly as before. Same "provider client is a plain async function, no Nest DI, no Prisma" shape
 * as the other two clients, so `currency-rate-sweep-runner.spec.ts` can mock it with one `vi.mock`.
 *
 * It replaces open.er-api.com in the fallback leg only — the ECB stays the sole source for every
 * currency it quotes (see `open-er-api-rates-client.ts`'s own header for why), and a row this feed
 * produced is stamped with its own `ALLRATESTODAY_SOURCE`, never `'ecb'`.
 *
 * AllRatesToday needs an API key (free trial, then paid plans), sent as `Authorization: Bearer`.
 * As with the open.er-api.com fallback, only the single computed cross-rate a company's own pair
 * needs is ever persisted; the full response body is parsed in memory and discarded.
 */

export const ALLRATESTODAY_BASE_CURRENCY = 'EUR';
export const ALLRATESTODAY_RATES_URL = `https://allratestoday.com/api/v1/rates?source=${ALLRATESTODAY_BASE_CURRENCY}`;

/** Same bound and same reasoning as `ecb-rates-client.ts#FETCH_TIMEOUT_MS`: this runs on the BullMQ
 *  worker thread, so a hang must not block the sweep. */
const FETCH_TIMEOUT_MS = 10_000;

/** The operator's key, or `undefined` when the opt-in is not configured (empty counts as unset). */
export function readAllRatesTodayApiKey(): string | undefined {
  const key = process.env.ALLRATESTODAY_API_KEY?.trim();
  return key ? key : undefined;
}

export interface AllRatesTodayRates {
  /** `ISO 4217 code -> "1 EUR is worth this many units of it"` — the SAME shape
   *  `EcbDailyRates.rates` holds, so `currency-rate-sweep.ts#computeCrossRate` is reused verbatim.
   *  EUR itself is never a key. */
  rates: Map<string, number>;
}

/** One element of the JSON array `GET /api/v1/rates?source=EUR` answers with on HTTP 200. Errors are
 *  a non-2xx status with `{"error": "..."}` (401 for a missing or invalid key). */
interface AllRatesTodayRateRow {
  source?: string;
  target?: string;
  rate?: number;
  time?: string;
}

/**
 * Fetches and parses AllRatesToday's EUR-based rates. Never returns a half-empty result: an HTTP
 * failure, a non-array body, a row with an unexpected base, or no usable rate at all throws a named
 * Error, so the runner's one call site treats it exactly like an open.er-api.com failure.
 */
export async function fetchAllRatesTodayRates(apiKey: string): Promise<AllRatesTodayRates> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let body: unknown;
  try {
    const response = await fetch(ALLRATESTODAY_RATES_URL, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      // The error body is `{"error": "..."}`; read it for the log line, but never let a malformed
      // error body mask the status code itself.
      const detail = await response
        .json()
        .then((b: { error?: unknown }) => (typeof b?.error === 'string' ? `: ${b.error}` : ''))
        .catch(() => '');
      throw new Error(`AllRatesToday rates feed responded with HTTP ${response.status}${detail}`);
    }
    body = await response.json();
  } finally {
    clearTimeout(timer);
  }
  return parseAllRatesTodayRates(body);
}

function parseAllRatesTodayRates(body: unknown): AllRatesTodayRates {
  if (!Array.isArray(body)) {
    throw new Error('AllRatesToday rates feed did not answer with a JSON array.');
  }

  const rates = new Map<string, number>();
  for (const row of body as AllRatesTodayRateRow[]) {
    if (row?.source !== ALLRATESTODAY_BASE_CURRENCY) {
      // Guards computeCrossRate's EUR-based math — the URL already fixes the base, so this only fires
      // if the feed starts answering a different base than the one requested.
      const got = row?.source ?? 'undefined';
      throw new Error(
        `AllRatesToday rates feed had source "${got}", expected "${ALLRATESTODAY_BASE_CURRENCY}".`,
      );
    }
    if (typeof row.target !== 'string' || row.target === ALLRATESTODAY_BASE_CURRENCY) continue;
    if (typeof row.rate === 'number' && Number.isFinite(row.rate) && row.rate > 0) {
      rates.set(row.target, row.rate);
    }
  }

  if (rates.size === 0) {
    throw new Error('AllRatesToday rates feed had no usable currency rates.');
  }

  return { rates };
}
