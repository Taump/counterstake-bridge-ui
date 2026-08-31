import { getPooledAssistants } from "services/api";

import { cachedTable } from "../cachedTable";
import { isRate, priceKey } from "../priceKey";

/**
 * Indexes the backend's per-bridge rates by asset and network.
 *
 * The backend prices bridges, not assets: each assistant carries the USD rate of its bridge's
 * home token and of its stake token. One bridge therefore prices three pairs — the home asset
 * on its chain, the image token on the foreign chain (worth its home asset, the only price an
 * EVM image has), and the stake asset on the foreign chain.
 *
 * @returns {Object<string, number>} priceKey → rate
 */
export const indexBackendRates = ({ assistants = [], bridges_info = [] } = {}) => {
  const bridgesById = {};
  for (const bridge of bridges_info) bridgesById[bridge.bridge_id] = bridge;

  const rates = {};
  const put = (asset, network, rate) => {
    if (asset && network && isRate(rate) && !(priceKey(asset, network) in rates))
      rates[priceKey(asset, network)] = rate;
  };

  for (const { bridge_id, home_token_usd_rate, stake_token_usd_rate } of assistants) {
    const bridge = bridgesById[bridge_id];
    if (!bridge) continue;

    put(bridge.home_asset, bridge.home_network, home_token_usd_rate);
    put(bridge.foreign_asset, bridge.foreign_network, home_token_usd_rate);
    put(bridge.stake_asset, bridge.foreign_network, stake_token_usd_rate);
  }

  return rates;
}

const TABLE_LIFETIME = 5 * 60 * 1000; // 5 minutes

const table = cachedTable(
  () => getPooledAssistants({ reqBridgesInfo: true }).then(({ data }) => indexBackendRates(data)),
  TABLE_LIFETIME
);

/**
 * The bridge backend's USD rates, computed server-side where the price APIs still answer.
 * Only knows assets that take part in a bridge.
 */
export const backendProvider = {
  name: "backend",

  supports: () => true,

  // one request answers for every pair at once, and the whole table is kept for a while;
  // pairs it doesn't know are simply left out
  getRates: async (pairs, { fresh } = {}) => {
    if (fresh) table.clear();
    const all = await table.get();
    const rates = {};
    for (const { asset, network } of pairs) {
      const key = priceKey(asset, network);
      if (key in all) rates[key] = all[key];
    }
    return rates;
  },
};
