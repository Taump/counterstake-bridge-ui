import { getTokenPriceInUsd, getTokenPricesInUsd, priceKey } from "./index";

jest.mock("./providers/oswap", () => ({ oswapProvider: { name: 'oswap', supports: jest.fn(), getRates: jest.fn() } }));
jest.mock("./providers/backend", () => ({ backendProvider: { name: 'backend', supports: jest.fn(), getRates: jest.fn() } }));
jest.mock("./providers/external", () => ({ externalProvider: { name: 'external', lastResort: true, supports: jest.fn(), getRates: jest.fn() } }));

const { oswapProvider } = require("./providers/oswap");
const { backendProvider } = require("./providers/backend");
const { externalProvider } = require("./providers/external");

const ETH_ON_OBYTE = { asset: 'RF/ysZ/ZY4leyc3huUq1yFc0xTS0GdeFQu8RmXas4ys=', network: 'Obyte' };
const ETH = { asset: '0x0000000000000000000000000000000000000000', network: 'Ethereum' };
const key = ({ asset, network }) => priceKey(asset, network);

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();

  oswapProvider.supports.mockImplementation(({ network }) => network === 'Obyte');
  backendProvider.supports.mockReturnValue(true);
  externalProvider.supports.mockReturnValue(true);

  oswapProvider.getRates.mockResolvedValue({});
  backendProvider.getRates.mockResolvedValue({});
  externalProvider.getRates.mockResolvedValue({});
});

describe('getTokenPricesInUsd', () => {
  it('asks the batch providers at once, each for what it supports', async () => {
    oswapProvider.getRates.mockResolvedValue({ [key(ETH_ON_OBYTE)]: 2438 });
    backendProvider.getRates.mockResolvedValue({ [key(ETH)]: 2463 });

    const rates = await getTokenPricesInUsd([ETH_ON_OBYTE, ETH], { fresh: true });

    expect(rates).toEqual({ [key(ETH_ON_OBYTE)]: 2438, [key(ETH)]: 2463 });
    // oswap only gets the Obyte pair; the backend is asked in parallel, not after oswap answers
    expect(oswapProvider.getRates).toHaveBeenCalledWith([ETH_ON_OBYTE], { fresh: true });
    expect(backendProvider.getRates).toHaveBeenCalledWith([ETH_ON_OBYTE, ETH], { fresh: true });
    expect(externalProvider.getRates).not.toHaveBeenCalled();
  });

  it('lets the more trusted provider win when both know a pair', async () => {
    oswapProvider.getRates.mockResolvedValue({ [key(ETH_ON_OBYTE)]: 2438 });
    backendProvider.getRates.mockResolvedValue({ [key(ETH_ON_OBYTE)]: 2463 });

    expect((await getTokenPricesInUsd([ETH_ON_OBYTE], { fresh: true }))[key(ETH_ON_OBYTE)]).toBe(2438);
  });

  it('does not wait for a slow provider to answer pairs it was never going to price', async () => {
    let releaseOswap;
    oswapProvider.getRates.mockReturnValue(new Promise(r => { releaseOswap = r; }));
    backendProvider.getRates.mockResolvedValue({ [key(ETH)]: 2463 });

    const pending = getTokenPricesInUsd([ETH_ON_OBYTE, ETH], { fresh: true });
    await new Promise(r => setTimeout(r, 0));
    expect(backendProvider.getRates).toHaveBeenCalled(); // already asked while oswap is still out

    releaseOswap({ [key(ETH_ON_OBYTE)]: 2438 });
    expect(await pending).toEqual({ [key(ETH_ON_OBYTE)]: 2438, [key(ETH)]: 2463 });
  });

  it('asks the last-resort provider only for what the batch providers did not know', async () => {
    backendProvider.getRates.mockResolvedValue({ [key(ETH)]: 2463 });
    externalProvider.getRates.mockResolvedValue({ [key(ETH_ON_OBYTE)]: 2400 });

    const rates = await getTokenPricesInUsd([ETH_ON_OBYTE, ETH], { fresh: true });

    expect(rates).toEqual({ [key(ETH_ON_OBYTE)]: 2400, [key(ETH)]: 2463 });
    expect(externalProvider.getRates).toHaveBeenCalledWith([ETH_ON_OBYTE], { fresh: true });
  });

  it('falls through to the next provider for what the first one did not know', async () => {
    backendProvider.getRates.mockResolvedValue({ [key(ETH_ON_OBYTE)]: 2463 });

    const rates = await getTokenPricesInUsd([ETH_ON_OBYTE], { fresh: true });

    expect(rates[key(ETH_ON_OBYTE)]).toBe(2463);
    expect(oswapProvider.getRates).toHaveBeenCalledTimes(1);
  });

  it('treats a failing provider as one that knows nothing', async () => {
    oswapProvider.getRates.mockRejectedValue(new Error('oswap down'));
    backendProvider.getRates.mockResolvedValue({ [key(ETH_ON_OBYTE)]: 2463 });

    expect((await getTokenPricesInUsd([ETH_ON_OBYTE], { fresh: true }))[key(ETH_ON_OBYTE)]).toBe(2463);
  });

  it('answers null, never zero, when no provider knows the asset', async () => {
    const rates = await getTokenPricesInUsd([ETH], { fresh: true });
    expect(rates[key(ETH)]).toBe(null);
    expect(externalProvider.getRates).toHaveBeenCalledWith([ETH], { fresh: true });
  });

  it('serves repeat requests from the cache and lets fresh bypass it', async () => {
    backendProvider.getRates.mockResolvedValue({ [key(ETH)]: 2463 });

    expect(await getTokenPriceInUsd(ETH.asset, ETH.network, { fresh: true })).toBe(2463);
    expect(await getTokenPriceInUsd(ETH.asset, ETH.network)).toBe(2463);
    expect(backendProvider.getRates).toHaveBeenCalledTimes(1);

    await getTokenPriceInUsd(ETH.asset, ETH.network, { fresh: true });
    expect(backendProvider.getRates).toHaveBeenCalledTimes(2);
    // and the provider is told to drop its own table too
    expect(backendProvider.getRates).toHaveBeenLastCalledWith([ETH], { fresh: true });
  });

  it('does not cache a miss, so a source that comes back gets asked again', async () => {
    expect(await getTokenPriceInUsd(ETH.asset, ETH.network, { fresh: true })).toBe(null);
    backendProvider.getRates.mockResolvedValue({ [key(ETH)]: 2463 });
    expect(await getTokenPriceInUsd(ETH.asset, ETH.network)).toBe(2463);
  });
});
