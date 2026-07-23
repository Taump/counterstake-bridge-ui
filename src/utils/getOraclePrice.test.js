import { ethers } from "ethers";

import socket from "services/socket";
import { getOraclePrice } from "./getOraclePrice";

const mockGetPrice = jest.fn();

jest.mock("ethers", () => {
  const actual = jest.requireActual("ethers");

  return {
    ...actual,
    ethers: {
      ...actual.ethers,
      Contract: jest.fn()
    }
  };
});

jest.mock("services/evm", () => ({
  providers: {
    BSC: "bsc-provider"
  }
}));

jest.mock("services/socket", () => ({
  api: {
    getDataFeed: jest.fn()
  }
}));

jest.mock("antd", () => ({
  message: {
    error: jest.fn()
  }
}));

beforeEach(() => {
  jest.resetAllMocks();
  ethers.Contract.mockImplementation(() => ({
    getPrice: mockGetPrice
  }));
});

test("uses the home network for an EVM base asset and returns num divided by den", async () => {
  mockGetPrice.mockResolvedValue({
    num: "13",
    den: "4"
  });

  const result = await getOraclePrice({
    network: "BSC",
    oracle: "0x0000000000000000000000000000000000000001",
    home_asset: "base",
    home_network: "Obyte",
    quote_asset: "_NATIVE_"
  });

  expect(ethers.Contract).toHaveBeenCalledWith(
    "0x0000000000000000000000000000000000000001",
    expect.any(Array),
    "bsc-provider"
  );
  expect(mockGetPrice).toHaveBeenCalledWith("Obyte", "_NATIVE_");
  expect(result).toEqual([true, 3.25]);
});

test.each([
  [{ num: "0", den: "4" }],
  [{ num: "13", den: "0" }]
])("rejects an EVM oracle price with a zero numerator or denominator", async (oracleResult) => {
  mockGetPrice.mockResolvedValue(oracleResult);

  const result = await getOraclePrice({
    network: "BSC",
    oracle: "0x0000000000000000000000000000000000000001",
    home_asset: "GBYTE",
    quote_asset: "USDC"
  });

  expect(mockGetPrice).toHaveBeenCalledWith("GBYTE", "USDC");
  expect(result).toEqual([false]);
});

test("applies Obyte feed multiplication and division in order", async () => {
  socket.api.getDataFeed
    .mockResolvedValueOnce(1200)
    .mockResolvedValueOnce(40);

  const result = await getOraclePrice({
    network: "Obyte",
    oracle1: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    feed_name1: "BNB_USD",
    op1: "*",
    oracle2: "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    feed_name2: "GBYTE_USD",
    op2: "/"
  });

  expect(socket.api.getDataFeed).toHaveBeenNthCalledWith(1, {
    oracles: ["AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"],
    feed_name: "BNB_USD",
    ifnone: "none"
  });
  expect(socket.api.getDataFeed).toHaveBeenNthCalledWith(2, {
    oracles: ["BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"],
    feed_name: "GBYTE_USD",
    ifnone: "none"
  });
  expect(result).toEqual([true, 30]);
});
