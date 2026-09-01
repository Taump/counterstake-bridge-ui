import config from "appConfig";
import { Cache } from "utils/Cache";

import { priceKey } from "./priceKey";
import { oswapProvider } from "./providers/oswap";
import { backendProvider } from "./providers/backend";
import { externalProvider } from "./providers/external";

const CACHE_LIFETIME = 30 * 60 * 1000; // 30 minutes

// In order of trust: the Obyte DEX for Obyte assets, then the bridge backend, then the public
// price APIs. Each pair is answered by the most trusted provider that knows it.
const PROVIDERS = [oswapProvider, backendProvider, externalProvider];

// Persisted, so a reload doesn't re-hit the sources and a known rate survives an outage of
// its source. Namespaced by environment so testnet prices never leak into mainnet.
const cache = new Cache(CACHE_LIFETIME, `cs-token-prices-${config.ENVIRONMENT || 'mainnet'}`);

export { priceKey };

/**
 * USD rates for several assets at once — the batch entry point the audit page uses, so that
 * a provider that answers for everything in one request is asked once, not per asset.
 *
 * @param {Array<{ asset: string, network: string }>} pairs
 * @param {{ fresh?: boolean }} [options] - `fresh` skips every cache, ours and the providers', for an explicit refresh
 * @returns {Promise<Object<string, number|null>>} priceKey → rate, null when no source knows it
 */
export const getTokenPricesInUsd = async (pairs, { fresh = false } = {}) => {
  const result = {};
  let pending = [];

  for (const pair of pairs) {
    const key = priceKey(pair.asset, pair.network);
    const cached = fresh ? null : cache.get(key);
    if (cached !== null) result[key] = cached;
    else if (!pending.some(p => priceKey(p.asset, p.network) === key)) pending.push(pair);
  }

  // Providers of one tier are asked at once for whatever they support — their sources don't
  // depend on each other, so the EVM sides shouldn't wait for Oswap to answer about the Obyte
  // ones. Within a tier the order only decides who wins when several know the same pair.
  const ask = async (providers) => {
    if (!pending.length) return;

    const answers = await Promise.all(providers.map(async (provider) => {
      const supported = pending.filter(pair => provider.supports(pair));
      if (!supported.length) return {};
      try {
        return await provider.getRates(supported, { fresh });
      } catch (e) {
        console.log(`prices: ${provider.name} failed`, e?.message);
        return {};
      }
    }));

    for (const rates of answers) {
      for (const [key, rate] of Object.entries(rates)) {
        if (key in result) continue; // a more trusted provider already answered
        result[key] = rate;
        cache.put(key, rate);
      }
    }
    pending = pending.filter(pair => !(priceKey(pair.asset, pair.network) in result));
  };

  // the batch providers cost one request however many pairs they're asked; the last-resort
  // ones cost one request per pair and rate-limit, so they only get what is still unanswered
  await ask(PROVIDERS.filter(provider => !provider.lastResort));
  await ask(PROVIDERS.filter(provider => provider.lastResort));

  for (const pair of pending) result[priceKey(pair.asset, pair.network)] = null;

  return result;
}

/**
 * USD rate of one asset on one network, or null when no source knows it.
 *
 * @param {string} asset - 'base' / an Obyte asset id / an EVM address (AddressZero for the native coin)
 * @param {string} network
 */
export const getTokenPriceInUsd = async (asset, network, options) => {
  const rates = await getTokenPricesInUsd([{ asset, network }], options);
  return rates[priceKey(asset, network)];
}
