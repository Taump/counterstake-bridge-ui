import config from "appConfig";

import { Cache } from "./Cache";

const REQUEST_TIMEOUT = 30 * 1000;
const SUPPLY_LIFETIME = 5 * 60 * 1000; // 5 minutes

// The explorer is the one slow source on the audit page — a cold asset can take it 10–20s —
// so a supply read within the last few minutes is reused across page reloads. Short-lived on
// purpose: it is a live balance, not metadata. Keyed by environment so testnet assets never
// answer for mainnet ones.
const cache = new Cache(SUPPLY_LIFETIME, `cs-obyte-supply-${config.ENVIRONMENT || 'mainnet'}`);

const getObyteExplorerBase = () => config.ENVIRONMENT === "testnet"
  ? "https://testnetexplorer.obyte.org"
  : "https://explorer.obyte.org";

// getExplorerLink() doesn't encode its argument and is meant for addresses and units,
// while an asset id is base64 and contains /, + and =
export const getObyteAssetUrl = (asset) => `${getObyteExplorerBase()}/asset/${encodeURIComponent(asset)}`;

/**
 * Validates the explorer's asset info response.
 *
 * The explorer excludes the issuer from both `supply` and `holders` for uncapped assets,
 * so for an import AA's asset this is exactly the amount held by users — the same value
 * the bridge backend computes as issues minus burns.
 *
 * A null supply means SUM() over an empty set, i.e. no holders at all. That is only a
 * legitimate zero when the holders list is empty too — otherwise the source is broken
 * and we must not silently report 0.
 *
 * @returns {string} supply in the smallest units
 */
export const validateAssetInfo = (data, asset, expected_decimals) => {
  if (!data || typeof data !== "object")
    throw new Error(`explorer returned no data for asset ${asset}`);

  if (data.assetUnit !== asset)
    throw new Error(`explorer returned asset ${data.assetUnit}, expected ${asset}`);

  if (expected_decimals !== undefined && data.decimals !== expected_decimals)
    throw new Error(`explorer reports ${data.decimals} decimals for ${asset}, expected ${expected_decimals}`);

  if (!("supply" in data))
    throw new Error(`explorer response for ${asset} has no supply field`);

  if (data.supply === null) {
    if (Array.isArray(data.holders) && data.holders.length === 0)
      return "0";
    throw new Error(`explorer reports null supply for ${asset} while holders are not empty`);
  }

  if (!Number.isInteger(data.supply))
    throw new Error(`explorer reports a non-integer supply ${data.supply} for ${asset}`);

  return String(data.supply);
}

/**
 * The Obyte import AA doesn't track the supply of the asset it issues, the hub has no
 * command for it, and the AA exposes no getter — the explorer is the only client-side source.
 *
 * @param {string} asset - 44-char asset id
 * @param {number} [expected_decimals] - from the bridges list, used to catch a wrong asset
 * @param {{ fresh?: boolean }} [options] - `fresh` skips the cache, for an explicit refresh
 * @returns {Promise<string>} supply in the smallest units
 */
export const getObyteAssetSupply = async (asset, expected_decimals, { fresh = false } = {}) => {
  if (!fresh) {
    const cached = cache.get(asset);
    if (cached !== null) return cached;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  let data;
  try {
    // a plain GET with no custom headers, so the browser doesn't send a preflight
    const response = await fetch(`${getObyteExplorerBase()}/api/asset/${encodeURIComponent(asset)}/info`, { signal: controller.signal });
    if (!response.ok)
      throw new Error(`explorer responded with ${response.status}`);
    data = await response.json();
  } catch (e) {
    throw new Error(e.name === "AbortError" ? `explorer request for ${asset} timed out` : e.message);
  } finally {
    clearTimeout(timeoutId);
  }

  const supply = validateAssetInfo(data, asset, expected_decimals);
  cache.put(asset, supply);
  return supply;
}
