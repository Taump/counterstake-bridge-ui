import { Cache } from "./Cache";

const TTL = 30 * 60 * 1000;
const KEY = 'cs-prices-test';

describe('Cache', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  it('returns a value within the TTL and nothing after it', () => {
    const cache = new Cache(TTL);
    cache.put('coingecko_ETH,USD', 2500);

    expect(cache.get('coingecko_ETH,USD')).toBe(2500);
    expect(cache.get('missing')).toBe(null);

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + TTL + 1);
    expect(cache.get('coingecko_ETH,USD')).toBe(null);
  });

  it('survives a reload when given a storage key', () => {
    new Cache(TTL, KEY).put('coingecko_GBYTE,USD', 12.5);

    // a fresh instance, as after a page reload
    expect(new Cache(TTL, KEY).get('coingecko_GBYTE,USD')).toBe(12.5);
  });

  it('keeps nothing in memory when no storage key is given', () => {
    new Cache(TTL).put('coingecko_GBYTE,USD', 12.5);

    expect(window.localStorage.length).toBe(0);
    expect(new Cache(TTL, KEY).get('coingecko_GBYTE,USD')).toBe(null);
  });

  it('drops entries that expired while the page was closed', () => {
    const now = Date.now();
    window.localStorage.setItem(KEY, JSON.stringify({
      fresh: { value: 1, ts: now - 60 * 1000 },
      stale: { value: 2, ts: now - TTL - 1000 },
    }));

    const cache = new Cache(TTL, KEY);
    expect(cache.get('fresh')).toBe(1);
    expect(cache.get('stale')).toBe(null);

    // and they don't linger in storage either
    cache.put('another', 3);
    expect(Object.keys(JSON.parse(window.localStorage.getItem(KEY))).sort()).toEqual(['another', 'fresh']);
  });

  it('keeps working when localStorage is unavailable or corrupted', () => {
    window.localStorage.setItem(KEY, 'not json');
    expect(new Cache(TTL, KEY).get('anything')).toBe(null);

    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });

    const cache = new Cache(TTL, KEY);
    cache.put('coingecko_ETH,USD', 2500);
    expect(cache.get('coingecko_ETH,USD')).toBe(2500); // memory still works
  });
});
