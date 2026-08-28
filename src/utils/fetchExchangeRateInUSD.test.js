import { fetchCoingeckoExchangeRate, fetchExchangeRateInUSD } from "./fetchExchangeRateInUSD";

const json = (body) => ({ ok: true, json: async () => body, text: async () => JSON.stringify(body) });

describe('fetchCoingeckoExchangeRate', () => {
  afterEach(() => { delete global.fetch; });

  it('asks CoinGecko by coin id and reads the quote back', async () => {
    global.fetch = jest.fn().mockResolvedValue(json({ byteball: { usd: 5.14 } }));

    expect(await fetchCoingeckoExchangeRate('GBYTE', 'USD')).toBe(5.14);
    expect(global.fetch.mock.calls[0][0]).toContain('simple/price?ids=byteball&vs_currencies=usd');
  });

  it('knows every native coin the bridge supports', async () => {
    for (const [symbol, id] of [['ETH', 'ethereum'], ['BNB', 'binancecoin'], ['MATIC', 'matic-network'], ['KAVA', 'kava']]) {
      global.fetch = jest.fn().mockResolvedValue(json({ [id]: { usd: 1 } }));
      expect(await fetchCoingeckoExchangeRate(symbol, 'USD')).toBe(1);
      expect(global.fetch.mock.calls[0][0]).toContain(`ids=${id}&`);
    }
  });

  it('throws for a coin it has no id for, and for an answer without the quote', async () => {
    await expect(fetchCoingeckoExchangeRate('DOGE', 'USD')).rejects.toThrow(/no CoinGecko id/);

    global.fetch = jest.fn().mockResolvedValue(json({}));
    await expect(fetchCoingeckoExchangeRate('ETH', 'USD')).rejects.toThrow(/no USD/);
  });
});

describe('fetchExchangeRateInUSD', () => {
  afterEach(() => { delete global.fetch; });

  it('prices the native coin of an EVM network through CoinGecko', async () => {
    global.fetch = jest.fn().mockResolvedValue(json({ ethereum: { usd: 2444 } }));
    expect(await fetchExchangeRateInUSD('Ethereum', '0x0000000000000000000000000000000000000000')).toBe(2444);
  });
});
