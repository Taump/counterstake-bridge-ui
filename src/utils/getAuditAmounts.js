import { BigNumber, ethers } from "ethers";

import { ERC20Abi, multicallAbi } from "abi";
import { providers } from "services/evm";

import { getMultiCallAddress } from "./getMulticallAddress";
import { getAaBalances } from "./getAaBalances";
import { getEvmErrorMessage } from "./handleEvmError";
import { withTimeout } from "./withTimeout";

const erc20Iface = new ethers.utils.Interface(ERC20Abi);
const multicallIface = new ethers.utils.Interface(multicallAbi);

const EVM_BATCH_TIMEOUT = 30 * 1000;
const OBYTE_BALANCES_TIMEOUT = 20 * 1000;

const ok = (bridge_id, field, value) => ({ bridge_id, field, status: "succeeded", value });
const failed = (bridge_id, field, error) => ({ bridge_id, field, status: "failed", error });

// One entry per value we want from the network. `target` is null for the native balance,
// which is read from the multicall contract itself so it rides in the same batch.
const getCallSpecs = (network, bridges) => bridges.flatMap(({ bridge_id, home_network, home_asset, export_aa, foreign_network, import_aa }) => {
  const specs = [];

  if (home_network === network) {
    specs.push(home_asset === ethers.constants.AddressZero
      ? { bridge_id, field: "locked", iface: multicallIface, method: "getEthBalance", args: [export_aa], target: null }
      : { bridge_id, field: "locked", iface: erc20Iface, method: "balanceOf", args: [export_aa], target: home_asset });
  }

  if (foreign_network === network) {
    specs.push({ bridge_id, field: "issued", iface: erc20Iface, method: "totalSupply", args: [], target: import_aa });
  }

  return specs;
});

/**
 * Reads every audit amount a single EVM network can answer for, in one logical multicall:
 * export contract balances for bridges whose home network it is, and image token supplies
 * for bridges whose foreign network it is.
 *
 * Never throws — a dead network or an unsupported one turns into error updates for exactly
 * the fields it was responsible for, so the other networks and Obyte are unaffected.
 *
 * @returns {Promise<Array<{bridge_id, field, status, value?, error?}>>}
 */
export const getEvmAuditAmounts = async (network, bridges) => {
  const specs = getCallSpecs(network, bridges);
  if (!specs.length) return [];

  const failAll = (message) => specs.map(({ bridge_id, field }) => failed(bridge_id, field, message));

  let results;
  try {
    const provider = providers[network];
    if (!provider)
      return failAll(`no RPC provider configured for ${network}`);

    const multicallAddress = getMultiCallAddress(network);
    const calls = specs.map(({ iface, method, args, target }) => ({
      target: target || multicallAddress,
      callData: iface.encodeFunctionData(method, args),
    }));
    const multicallContract = new ethers.Contract(multicallAddress, multicallAbi, provider);

    results = await withTimeout(
      multicallContract.callStatic.tryAggregate(false, calls),
      EVM_BATCH_TIMEOUT,
      `${network} multicall`
    );
  } catch (e) {
    console.log(`audit: multicall on ${network} failed`, e);
    return failAll(getEvmErrorMessage(e) || e.message || `read on ${network} failed`);
  }

  return specs.map(({ bridge_id, field, iface, method }, i) => {
    const result = results[i];
    if (!result || !result.success)
      return failed(bridge_id, field, `${method} call failed on ${network}`);

    try {
      return ok(bridge_id, field, BigNumber.from(iface.decodeFunctionResult(method, result.returnData)[0]).toString());
    } catch (e) {
      console.log(`audit: failed to decode ${method} for bridge ${bridge_id}`, e);
      return failed(bridge_id, field, `could not decode ${method} on ${network}`);
    }
  });
}

/**
 * Reads the export AA's balance in the home asset. Never throws.
 *
 * @returns {Promise<{bridge_id, field, status, value?, error?}>}
 */
export const getObyteLockedAmount = async ({ bridge_id, export_aa, home_asset }) => {
  try {
    const balances = await withTimeout(getAaBalances(export_aa), OBYTE_BALANCES_TIMEOUT, `balances of ${export_aa}`);
    const balance = balances?.[home_asset];
    return ok(bridge_id, "locked", balance === undefined || balance === null ? "0" : String(balance));
  } catch (e) {
    console.log(`audit: failed to read Obyte balance of ${export_aa}`, e);
    return failed(bridge_id, "locked", e.message);
  }
}
