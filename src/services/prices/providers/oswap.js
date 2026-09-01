import config from "appConfig";

import { cachedTable } from "../cachedTable";
import { isRate, priceKey } from "../priceKey";

const OSWAP_RATES_URL = "https://v2-data.oswap.io/api/v1/exchangeRates";
const REQUEST_TIMEOUT = 15 * 1000;
const TABLE_LIFETIME = 5 * 60 * 1000; // 5 minutes

// The feed keys every Obyte asset as `<asset id>_USD`; bytes are the one exception.
export const getOswapRateKey = (asset) => asset === "base" ? "GBYTE_USD" : `${asset}_USD`;

const fetchAllRates = async () => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    // a plain GET with no custom headers, so the browser doesn't send a preflight
    const response = await fetch(OSWAP_RATES_URL, { signal: controller.signal });
    if (!response.ok)
      throw new Error(`oswap responded with ${response.status}`);

    const data = await response.json();
    if (!data || typeof data !== "object")
      throw new Error("oswap returned no rates");
    return data;
  } catch (e) {
    throw new Error(e.name === "AbortError" ? "oswap rates request timed out" : e.message);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * USD rates of Obyte assets as they trade on Oswap. For a bridge's image token this is the
 * price the token actually fetches on Obyte — the honest value of what was issued there, which
 * can drift from the underlying asset's global price when the image is illiquid.
 *
 * Mainnet only: there is no testnet feed.
 */
const table = cachedTable(fetchAllRates, TABLE_LIFETIME);

export const oswapProvider = {
  name: "oswap",

  supports: ({ network }) => network === "Obyte" && config.ENVIRONMENT === "mainnet",

  // one request answers for every pair at once, and the whole table is kept for a while
  getRates: async (pairs, { fresh } = {}) => {
    if (fresh) table.clear();
    const all = await table.get();
    const rates = {};
    for (const { asset, network } of pairs) {
      const rate = all[getOswapRateKey(asset)];
      if (isRate(rate)) rates[priceKey(asset, network)] = rate;
    }
    return rates;
  },
};
