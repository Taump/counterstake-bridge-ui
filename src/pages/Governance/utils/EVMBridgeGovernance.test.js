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
