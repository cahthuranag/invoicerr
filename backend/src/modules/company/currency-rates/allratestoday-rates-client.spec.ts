import { vi } from 'vitest';

import { fetchAllRatesTodayRates, readAllRatesTodayApiKey } from './allratestoday-rates-client';

/** A trimmed fixture with the same shape `GET https://allratestoday.com/api/v1/rates?source=EUR`
 *  returns — a JSON array of `{source, target, rate, time}` — with three currencies. */
const FIXTURE_BODY = [
  { source: 'EUR', target: 'USD', rate: 1.159656, time: '2026-10-22T12:00:00Z' },
  { source: 'EUR', target: 'MAD', rate: 10.90371, time: '2026-10-22T12:00:00Z' },
  { source: 'EUR', target: 'GBP', rate: 0.857617, time: '2026-10-22T12:00:00Z' },
];

function mockFetchOnce(body: unknown, ok = true, status = 200): void {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  }) as unknown as typeof fetch;
}

describe('fetchAllRatesTodayRates', () => {
  afterEach(() => vi.resetAllMocks());

  it('parses every target/rate pair from the fixture and sends the key as a Bearer token', async () => {
    mockFetchOnce(FIXTURE_BODY);

    const { rates } = await fetchAllRatesTodayRates('test-key');

    expect(rates.get('USD')).toBe(1.159656);
    expect(rates.get('MAD')).toBe(10.90371);
    expect(rates.get('GBP')).toBe(0.857617);
    expect(rates.size).toBe(3);
    expect(rates.has('EUR')).toBe(false);

    const [url, init] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://allratestoday.com/api/v1/rates?source=EUR');
    expect(init.headers.Authorization).toBe('Bearer test-key');
  });

  it('throws with the status and the error message when the HTTP response is not ok', async () => {
    mockFetchOnce({ error: 'Invalid API key' }, false, 401);

    await expect(fetchAllRatesTodayRates('bad-key')).rejects.toThrow(/HTTP 401: Invalid API key/);
  });

  it('throws when the body is not an array', async () => {
    mockFetchOnce({ rates: {} });

    await expect(fetchAllRatesTodayRates('test-key')).rejects.toThrow(/JSON array/);
  });

  it('throws when a row is not EUR-based — guards the EUR-based composition math downstream', async () => {
    mockFetchOnce([{ source: 'USD', target: 'EUR', rate: 0.86 }]);

    await expect(fetchAllRatesTodayRates('test-key')).rejects.toThrow(/expected "EUR"/);
  });

  it('throws when the array carries nothing usable', async () => {
    mockFetchOnce([]);

    await expect(fetchAllRatesTodayRates('test-key')).rejects.toThrow(/no usable currency rates/);
  });
});

describe('readAllRatesTodayApiKey', () => {
  const original = process.env.ALLRATESTODAY_API_KEY;
  afterEach(() => {
    if (original === undefined) delete process.env.ALLRATESTODAY_API_KEY;
    else process.env.ALLRATESTODAY_API_KEY = original;
  });

  it('is undefined when unset or blank, so the default fallback is untouched', () => {
    delete process.env.ALLRATESTODAY_API_KEY;
    expect(readAllRatesTodayApiKey()).toBeUndefined();
    process.env.ALLRATESTODAY_API_KEY = '   ';
    expect(readAllRatesTodayApiKey()).toBeUndefined();
  });

  it('returns the trimmed key when set', () => {
    process.env.ALLRATESTODAY_API_KEY = ' abc ';
    expect(readAllRatesTodayApiKey()).toBe('abc');
  });
});
