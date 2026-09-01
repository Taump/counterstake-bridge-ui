const DEFAULT_TTL = 10 * 60 * 1000; // 10 minutes

const isFresh = (record, ttl) => !!record && typeof record === 'object' && record.ts >= Date.now() - ttl;

// localStorage throws in private mode, when the browser blocks site data, or when the quota is
// full. None of that should break the caller — we just fall back to an in-memory cache.
const readStorage = (storageKey) => {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    return null;
  }
}

const writeStorage = (storageKey, data) => {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(data));
  } catch (e) {
    console.log(`could not persist cache ${storageKey}`, e?.message);
  }
}

/**
 * In-memory key-value cache with a per-instance TTL, optionally backed by localStorage.
 *
 * With a storageKey the cache survives a page reload and, more importantly, an outage of the
 * source it caches: entries stay usable for the whole TTL no matter how many times the page
 * was reopened. Expired entries are dropped on load and on every write, so the stored blob
 * doesn't grow forever.
 *
 * @example
 * const cache = new Cache(30 * 60 * 1000, 'cs-token-prices-mainnet');
 */
export class Cache {
  #data = {};
  #ttl;
  #storageKey;

  constructor(ttl = DEFAULT_TTL, storageKey) {
    this.#ttl = ttl;
    this.#storageKey = storageKey;

    if (storageKey) {
      const stored = readStorage(storageKey);
      for (const key in stored)
        if (isFresh(stored[key], ttl)) this.#data[key] = stored[key];
    }
  }

  get(key) {
    const record = this.#data[key];
    if (!isFresh(record, this.#ttl)) return null;
    return record.value;
  }

  put(key, value) {
    this.#data[key] = { value, ts: Date.now() };

    if (!this.#storageKey) return;

    for (const stored in this.#data)
      if (!isFresh(this.#data[stored], this.#ttl)) delete this.#data[stored];

    writeStorage(this.#storageKey, this.#data);
  }
}
