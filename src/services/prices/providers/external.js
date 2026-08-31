import { fetchExchangeRateInUSD } from "utils/fetchExchangeRateInUSD";

import { isRate, priceKey } from "../priceKey";

/**
 * The public price APIs (CoinGecko, ostable), asked one asset at a time. Last in the chain:
 * CoinGecko rate-limits per IP, but they are the only source for an asset that is in no
 * bridge — e.g. a token someone is about to create a bridge for.
 */
export const externalProvider = {
  name: "external",
  lastResort: true, // one request per pair and rate-limited: asked only for what nobody else knew

  supports: () => true,

  getRates: async (pairs) => {
    const rates = {};
    await Promise.all(pairs.map(async ({ asset, network }) => {
      const rate = await fetchExchangeRateInUSD(network, asset, true);
      if (isRate(rate)) rates[priceKey(asset, network)] = rate;
    }));
    return rates;
  },
};
