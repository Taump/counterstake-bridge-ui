import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ChangeParamsModal } from "./ChangeParamsModal";
import { getOraclePrice } from "utils/getOraclePrice";

jest.mock("react-redux", () => ({
  useDispatch: () => jest.fn()
}));

jest.mock("utils", () => ({
  generateLink: jest.fn(),
  getEvmErrorMessage: jest.fn()
}));

jest.mock("pages/Governance/utils/EVMBridgeGovernance", () => ({
  EVMBridgeGovernance: jest.fn()
}));

jest.mock("store/thunks/updateActiveGovernanceAA", () => ({
  updateActiveGovernanceAA: jest.fn()
}));

jest.mock("utils/checkOracles", () => ({
  checkOracles: jest.fn()
}));

jest.mock("utils/getOraclePrice", () => ({
  getOraclePrice: jest.fn()
}));

const defaultProps = {
  name: "min_price",
  activeGovernance: "0x0000000000000000000000000000000000000001",
  activeWallet: "0x0000000000000000000000000000000000000002",
  balance: 0,
  bridge_network: "BSC",
  bridge_symbol: "GBYTE",
  home_asset: "base",
  home_network: "Obyte",
  oracleAddress: "0x0000000000000000000000000000000000000003",
  selectedBridgeAddress: "0x0000000000000000000000000000000000000004",
  stakeTokenAddress: "0x0000000000000000000000000000000000000000",
  stakeTokenDecimals: 18,
  stakeTokenSymbol: "BNB",
  voteTokenAddress: "0x0000000000000000000000000000000000000005",
  voteTokenDecimals: 9,
  voteTokenSymbol: "GBYTE"
};

beforeAll(() => {
  window.matchMedia = window.matchMedia || (() => ({
    addListener: jest.fn(),
    removeListener: jest.fn(),
    matches: false
  }));
});

beforeEach(() => {
  getOraclePrice.mockReset();
});

test("loads and displays the current oracle price in the min price modal", async () => {
  getOraclePrice.mockResolvedValue([true, 0.00325]);

  render(<ChangeParamsModal {...defaultProps} />);

  fireEvent.click(screen.getByRole("button", { name: "suggest another value" }));

  await waitFor(() => {
    expect(getOraclePrice).toHaveBeenCalledWith({
      network: "BSC",
      home_asset: "base",
      home_network: "Obyte",
      quote_asset: "_NATIVE_",
      oracle: "0x0000000000000000000000000000000000000003",
      silent: true
    });
  });

  expect(await screen.findByText("1 GBYTE = 0.00325 BNB")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Amount in GBYTE")).toBeInTheDocument();
});

test("uses an ERC20 bridge stake asset as the EVM oracle quote", async () => {
  getOraclePrice.mockResolvedValue([true, 1.25]);

  render(<ChangeParamsModal
    {...defaultProps}
    stakeTokenAddress="0x0000000000000000000000000000000000000006"
    stakeTokenDecimals={18}
    stakeTokenSymbol="STAKE"
  />);

  fireEvent.click(screen.getByRole("button", { name: "suggest another value" }));

  await waitFor(() => {
    expect(getOraclePrice).toHaveBeenCalledWith(expect.objectContaining({
      quote_asset: "STAKE"
    }));
  });

  expect(await screen.findByText("1 GBYTE = 1.25 STAKE")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Amount in GBYTE")).toBeInTheDocument();
});

test("loads and displays a composed Obyte oracle price", async () => {
  getOraclePrice.mockResolvedValue([true, 42.5]);

  render(<ChangeParamsModal
    {...defaultProps}
    bridge_network="Obyte"
    bridge_symbol="BNB"
    oracleAddress="JEDZYC2HMGDBIDQKG3XSTXUSHMCBK725*BNB_USD JEDZYC2HMGDBIDQKG3XSTXUSHMCBK725/GBYTE_USD"
    stakeTokenAddress="base"
    stakeTokenDecimals={9}
    stakeTokenSymbol="GBYTE"
    voteTokenAddress="base"
    voteTokenDecimals={9}
    voteTokenSymbol="GBYTE"
  />);

  fireEvent.click(screen.getByRole("button", { name: "suggest another value" }));

  await waitFor(() => {
    expect(getOraclePrice).toHaveBeenCalledWith({
      oracle1: "JEDZYC2HMGDBIDQKG3XSTXUSHMCBK725",
      feed_name1: "BNB_USD",
      op1: "*",
      oracle2: "JEDZYC2HMGDBIDQKG3XSTXUSHMCBK725",
      feed_name2: "GBYTE_USD",
      op2: "/",
      network: "Obyte",
      silent: true
    });
  });

  expect(await screen.findByText("1 BNB = 42.5 GBYTE")).toBeInTheDocument();
});
