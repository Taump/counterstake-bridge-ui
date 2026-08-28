/**
 * Memoises a provider's whole rate table for a while.
 *
 * Oswap and the bridge backend answer with every rate they know in one response, but the
 * facade only asks for the pairs it needs right now. Without this, a second batch — or a
 * single pair asked a moment later — would fetch the same table again. Holding the in-flight
 * promise also means concurrent callers share one request instead of racing each other.
 *
 * A failed load is not kept, so the next caller retries.
 *
 * @param {() => Promise<Object>} load
 * @param {number} ttl - milliseconds
 * @returns {{ get: () => Promise<Object>, clear: () => void }}
 */
export const cachedTable = (load, ttl) => {
  let pending = null;
  let loadedAt = 0;

  const isFresh = () => pending && Date.now() - loadedAt < ttl;

  return {
    get: () => {
      if (isFresh()) return pending;

      loadedAt = Date.now();
      pending = load().catch((e) => {
        pending = null;
        throw e;
      });
      return pending;
    },
    clear: () => { pending = null; },
  };
}
