import { getOswapRateKey, oswapProvider } from "./oswap";
import { priceKey } from "../priceKey";

const ETH_ON_OBYTE = 'RF/ysZ/ZY4leyc3huUq1yFc0xTS0GdeFQu8RmXas4ys=';

describe('oswap provider', () => {
  afterEach(() => { delete global.fetch; });

  it('maps bytes to GBYTE and any other asset to its id', () => {
    expect(getOswapRateKey('base')).toBe('GBYTE_USD');
    expect(getOswapRateKey(ETH_ON_OBYTE)).toBe(`${ETH_ON_OBYTE}_USD`);
  });

  it('only answers for Obyte assets', () => {
    expect(oswapProvider.supports({ asset: 'base', network: 'Obyte' })).toBe(true);
    expect(oswapProvider.supports({ asset: '0x0', network: 'Ethereum' })).toBe(false);
  });

  it('picks the requested pairs out of the feed and drops what it has no price for', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ GBYTE_USD: 4.99, [`${ETH_ON_OBYTE}_USD`]: 2438, unrelated_USD: 1 }),
    });

    const rates = await oswapProvider.getRates([
      { asset: 'base', network: 'Obyte' },
      { asset: ETH_ON_OBYTE, network: 'Obyte' },
      { asset: 'unlisted', network: 'Obyte' },
    ], { fresh: true });

    expect(rates).toEqual({ [priceKey('base', 'Obyte')]: 4.99, [priceKey(ETH_ON_OBYTE, 'Obyte')]: 2438 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('answers a later batch from the same feed instead of fetching it again', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ GBYTE_USD: 4.99 }) });

    await oswapProvider.getRates([{ asset: 'base', network: 'Obyte' }], { fresh: true });
    const again = await oswapProvider.getRates([{ asset: 'base', network: 'Obyte' }]);

    expect(again).toEqual({ [priceKey('base', 'Obyte')]: 4.99 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws on a bad response instead of answering zeros', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 502 });
    await expect(oswapProvider.getRates([{ asset: 'base', network: 'Obyte' }], { fresh: true })).rejects.toThrow(/502/);
  });
});
