import { ethers } from "ethers";

import { EVMBridgeGovernance } from "./EVMBridgeGovernance";

jest.mock("services/evm", () => ({
  providers: { BSC: null }
}));

const BRIDGE = "0xa5893a1A1FF15031d8AB5aC24531D3B3418612EE";
const GOVERNANCE = "0xdd661c2995efa183e8412b203Ca27dB95900CEb4";
const WALLET = "0xbd2C1400eA794D837669d3A83Ef8B3534579b5BF";

const encodeAddress = (address) => ethers.utils.defaultAbiCoder.encode(["address"], [address]);

const makeGovernance = (multicallResults) => {
  const evm = new EVMBridgeGovernance("BSC", BRIDGE, 18, WALLET, 18);
  evm.governance_contract_address = GOVERNANCE;
  evm._multicall = jest.fn().mockResolvedValue(multicallResults);
  return evm;
};

// votedValues() is a public-array getter that needs an index, so it can't enumerate the contracts.
test("resolves the parameter contracts by name", async () => {
  const addressFor = (i) => ethers.utils.getAddress("0x" + String(i + 1).padStart(40, "0"));

  const evm = makeGovernance(
    Object.keys(evmParameterList()).map((_, i) => ({ success: true, returnData: encodeAddress(addressFor(i)) }))
  );

  const contracts = await evm.getParamContracts();

  expect(Object.keys(contracts)).toEqual(Object.keys(evmParameterList()));
  expect(contracts.large_threshold).toBe(addressFor(Object.keys(evmParameterList()).indexOf("large_threshold")));

  // one multicall, querying votedValuesMap by each parameter's on-chain name
  expect(evm._multicall).toHaveBeenCalledTimes(1);
  const names = evm._multicall.mock.calls[0][0].map(
    (call) => ethers.utils.defaultAbiCoder.decode(["string"], "0x" + call.callData.slice(10))[0]
  );
  expect(names).toContain("ratio100");
  expect(names).toContain("large_threshold");
});

test("leaves out parameters this bridge doesn't govern", async () => {
  const keys = Object.keys(evmParameterList());
  const evm = makeGovernance(keys.map((key, i) => ({
    success: key !== "min_stake",
    returnData: encodeAddress(key === "min_price" ? ethers.constants.AddressZero : "0x" + String(i + 1).padStart(40, "0"))
  })));

  const contracts = await evm.getParamContracts();

  expect(contracts).not.toHaveProperty("min_stake"); // failed call
  expect(contracts).not.toHaveProperty("min_price"); // zero address
  expect(contracts).toHaveProperty("large_threshold");
});

function evmParameterList() {
  // eslint-disable-next-line global-require
  return require("./getParameterList").getParameterList("BSC");
}

// min_price20 is read straight from the bridge, unlike the other settings, so it must be kept in the
// same raw 20-decimal units as the leader: GovernanceItem shows "commit" while they differ.
test("keeps min_price in raw units so it matches the leader after a commit", async () => {
  const { counterstakeAbi, governanceAbi, votedValueUintAbi } = require("abi");
  const { viewParam } = require("./viewParam");

  const bridgeIface = new ethers.utils.Interface(counterstakeAbi);
  const govIface = new ethers.utils.Interface(governanceAbi);
  const uintIface = new ethers.utils.Interface(votedValueUintAbi);
  const encode = (types, values) => ethers.utils.defaultAbiCoder.encode(types, values);
  const ok = (returnData) => ({ success: true, returnData });

  const list = evmParameterList();
  const keys = Object.keys(list);
  const paramAddress = {};
  keys.forEach((key, i) => { paramAddress[key] = ethers.utils.getAddress("0x" + String(i + 1).padStart(40, "0")); });
  const keyByAddress = Object.fromEntries(keys.map((key) => [paramAddress[key], key]));

  // a fractional price: the old formatted value could not be fed back into BigNumber
  const MIN_PRICE = ethers.utils.parseUnits("0.5", 20);
  const SUPPORT = ethers.utils.parseUnits("1", 18);

  const evm = makeGovernance([]);
  evm._multicall = jest.fn(async (calls) => calls.map(({ target, callData }) => {
    const selector = callData.slice(0, 10);
    if (target === BRIDGE) {
      if (selector === bridgeIface.getSighash("governance")) return ok(encode(["address"], [GOVERNANCE]));
      if (selector === bridgeIface.getSighash("settings")) return ok(encode(["address", "uint16", "uint16", "uint32", "uint256", "uint256"], [ethers.constants.AddressZero, 150, 150, 0, 0, 0]));
      if (selector === bridgeIface.getSighash("getChallengingPeriod")) return ok(encode(["uint256"], [3 * 24 * 3600]));
      if (selector === ethers.utils.id("min_price20()").slice(0, 10)) return ok(encode(["uint256"], [MIN_PRICE]));
      if (selector === ethers.utils.id("oracleAddress()").slice(0, 10)) return ok(encode(["address"], [WALLET]));
    }
    if (target === GOVERNANCE) {
      const name = ethers.utils.defaultAbiCoder.decode(["string"], "0x" + callData.slice(10))[0];
      const key = keys.find((k) => (list[k].evm_name || list[k].name) === name);
      return ok(encode(["address"], [paramAddress[key]]));
    }
    if (keyByAddress[target] === "min_price") {
      if (selector === uintIface.getSighash("leader")) return ok(encode(["uint256"], [MIN_PRICE]));
      if (selector === uintIface.getSighash("votesByValue")) return ok(encode(["uint256"], [SUPPORT]));
    }
    return { success: false, returnData: "0x" }; // no votes, no leader on the other params
  }));

  const state = await evm.initState("import");

  expect(state.min_price.value).toBe(MIN_PRICE.toString());
  expect(state.min_price.leader).toBe(state.min_price.value);
  expect(Object.keys(state.min_price.supports)).toEqual([MIN_PRICE.toString()]);
  expect(viewParam({ name: "min_price", value: state.min_price.value, network: "BSC" })).toBe(0.5);
  expect(viewParam({ name: "min_price", value: state.min_price.leader, network: "BSC" })).toBe(0.5);
});
