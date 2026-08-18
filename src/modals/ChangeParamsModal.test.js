import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ChangeParamsModal } from "./ChangeParamsModal";
import { EVMBridgeGovernance } from "pages/Governance/utils/EVMBridgeGovernance";
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
  EVMBridgeGovernance.mockReset();
});

// Votes for an already suggested value and returns the changeParam() mock it was sent to.
const voteForSupportedValue = async (props) => {
  const changeParam = jest.fn();
  EVMBridgeGovernance.mockImplementation(() => ({ changeParam }));

  render(<ChangeParamsModal {...defaultProps} {...props} />);

  fireEvent.click(screen.getByRole("button", { name: "vote for this value" }));
  fireEvent.click(await screen.findByRole("button", { name: "Vote" }));

  await waitFor(() => expect(changeParam).toHaveBeenCalled());

  return changeParam;
};

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

// parseUnits() only accepts strings, so a value read from the contract must not be turned into a
// number on its way back — that used to fail the vote with "value must be a string".
test("sends an already suggested large_threshold back as a string", async () => {
  const changeParam = await voteForSupportedValue({
    name: "large_threshold",
    supportedValue: "10000000000000000000",
    balance: "480030000000000"
  });

  expect(changeParam).toHaveBeenCalledWith("large_threshold", "10", undefined, expect.any(Function));
});

// Number() would turn this into 1e-8, which parseUnits() rejects as an invalid decimal value.
test("keeps a small min_price exact instead of using exponential notation", async () => {
  getOraclePrice.mockResolvedValue([true, 0.00325]);

  const changeParam = await voteForSupportedValue({
    supportedValue: "1000000000000",
    balance: "480030000000000"
  });

  expect(changeParam).toHaveBeenCalledWith("min_price", "0.00000001", undefined, expect.any(Function));
});

// The submit button is reached through a ref, and it is now wrapped in a Tooltip.
test("still submits on Enter", async () => {
  const changeParam = jest.fn();
  EVMBridgeGovernance.mockImplementation(() => ({ changeParam }));

  render(<ChangeParamsModal
    {...defaultProps}
    name="large_threshold"
    supportedValue="10000000000000000000"
    balance="480030000000000"
  />);

  fireEvent.click(screen.getByRole("button", { name: "vote for this value" }));
  fireEvent.keyPress(screen.getByPlaceholderText("Amount in GBYTE"), { key: "Enter", code: "Enter", charCode: 13 });

  await waitFor(() => expect(changeParam).toHaveBeenCalled());
});

// A vote recounts the whole current balance, so re-voting for your own choice still raises its
// support after a later deposit — the modal used to demand new funds for it regardless.
const openOwnChoice = async (props) => {
  EVMBridgeGovernance.mockImplementation(() => ({ changeParam: jest.fn() }));

  render(<ChangeParamsModal
    {...defaultProps}
    name="large_threshold"
    supportedValue="10000000000000000000"
    balance="480030000000000"
    isMyChoice
    {...props}
  />);

  fireEvent.click(screen.getByRole("button", { name: "add support for this value" }));

  return screen.getByRole("button", { name: "Vote" });
};

test("allows re-voting for your own choice when your balance outgrew its recorded support", async () => {
  const vote = await openOwnChoice({ myChoiceSupport: "10000000" });

  expect(vote).toBeEnabled();
  expect(screen.getByText("Add more funds (optional):")).toBeInTheDocument();
});

test("requires new funds only once the recorded support covers the whole balance", async () => {
  const vote = await openOwnChoice({ myChoiceSupport: "480030000000000" });

  expect(vote).toBeDisabled();
  expect(screen.getByText("Add more funds:")).toBeInTheDocument();

  fireEvent.change(screen.getByPlaceholderText("Amount in GBYTE"), { target: { value: "0.0001" } });

  expect(screen.getByRole("button", { name: "Vote" })).toBeEnabled();
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

test("allows voting for an already suggested EVM oracle address without overwriting it", async () => {
  const oracleAddr = "0x0b93109d05Ef330acD2c75148891cc61D20C3EF1";
  const changeParam = await voteForSupportedValue({
    name: "oracles",
    supportedValue: oracleAddr,
    balance: "480030000000000"
  });

  expect(changeParam).toHaveBeenCalledWith("oracles", oracleAddr, undefined, expect.any(Function));
});

test("validates and votes for a new EVM oracle address", async () => {
  const changeParam = jest.fn();
  EVMBridgeGovernance.mockImplementation(() => ({ changeParam }));

  render(<ChangeParamsModal
    {...defaultProps}
    name="oracles"
    balance="480030000000000"
  />);

  fireEvent.click(screen.getByRole("button", { name: "suggest another value" }));

  const input = screen.getByPlaceholderText("oracles");
  const voteBtn = screen.getByRole("button", { name: "Vote" });

  // Invalid address disables the vote button and displays rule error
  fireEvent.change(input, { target: { value: "invalid-address" } });
  expect(screen.getByRole("button", { name: "Vote" })).toBeDisabled();
  expect(screen.getByText("The value of the oracle parameter must be a valid EVM address")).toBeInTheDocument();

  // Valid checksummed address enables the vote button
  const validOracle = "0x0b93109d05Ef330acD2c75148891cc61D20C3EF1";
  fireEvent.change(input, { target: { value: validOracle } });
  expect(screen.getByRole("button", { name: "Vote" })).toBeEnabled();

  fireEvent.click(screen.getByRole("button", { name: "Vote" }));
  await waitFor(() => expect(changeParam).toHaveBeenCalledWith("oracles", validOracle, undefined, expect.any(Function)));
});




