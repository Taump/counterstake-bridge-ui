import { ethers } from "ethers";

import { EVMBridgeGovernance } from "pages/Governance/utils/EVMBridgeGovernance";
import { changeActiveGovernanceAA } from "./changeActiveGovernanceAA";
import { getDecimals, getSymbol } from "utils";

jest.mock("pages/Governance/utils/EVMBridgeGovernance", () => ({
  EVMBridgeGovernance: jest.fn()
}));

jest.mock("services/socket", () => ({
  api: {}
}));

jest.mock("utils", () => ({
  getDecimals: jest.fn(),
  getSymbol: jest.fn()
}));

test("keeps the EVM governance token separate from the bridge stake asset", async () => {
  const bridgeAddress = "0x0000000000000000000000000000000000000001";
  const governanceAddress = "0x0000000000000000000000000000000000000002";
  const votingTokenAddress = "0x0000000000000000000000000000000000000003";
  const stakeTokenAddress = ethers.constants.AddressZero;

  EVMBridgeGovernance.mockImplementation(() => ({
    getGovernanceContractAddress: jest.fn().mockResolvedValue(governanceAddress),
    getVotingTokenAddress: jest.fn().mockResolvedValue(votingTokenAddress),
    initState: jest.fn().mockResolvedValue({})
  }));

  getDecimals.mockImplementation((address) => Promise.resolve(address === votingTokenAddress ? 9 : 18));
  getSymbol.mockImplementation((address) => Promise.resolve(address === votingTokenAddress ? "GBYTE" : "BNB"));

  const getState = () => ({
    governance: {
      importList: {
        [bridgeAddress]: {
          network: "BSC",
          symbol: "GBYTE",
          decimals: 9,
          type: "import",
          stake_asset: stakeTokenAddress,
          home_asset: "base"
        }
      },
      exportList: {}
    },
    destAddress: {}
  });

  const result = await changeActiveGovernanceAA({ bridge_aa: bridgeAddress })(
    jest.fn(),
    getState,
    undefined
  );

  expect(result.type).toBe("update/changeActiveGovernanceAA/fulfilled");
  expect(result.payload).toMatchObject({
    voteTokenAddress: votingTokenAddress,
    voteTokenDecimals: 9,
    voteTokenSymbol: "GBYTE",
    stakeTokenAddress,
    stakeTokenDecimals: 18,
    stakeTokenSymbol: "BNB"
  });
  expect(getDecimals).toHaveBeenCalledWith(stakeTokenAddress, "BSC");
  expect(getSymbol).toHaveBeenCalledWith(stakeTokenAddress, "BSC");
});
