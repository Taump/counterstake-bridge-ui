/**
 * Rejects if the promise doesn't settle within `ms`.
 * The underlying promise is not cancelled — the caller just stops waiting for it.
 *
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} label - included in the error message to tell timeouts apart
 * @returns {Promise<T>}
 */
export const withTimeout = (promise, ms, label = 'operation') => {
  let timeoutId;

  const timeout = new Promise((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}
