import { getObyteAssetSupply, getObyteAssetUrl, validateAssetInfo } from "./getObyteAssetSupply";

const ASSET = "RF/ysZ/ZY4leyc3huUq1yFc0xTS0GdeFQu8RmXas4ys=";

const makeInfo = (overrides) => ({
  assetUnit: ASSET,
  name: "ETH",
  decimals: 8,
  supply: 289839209,
  holders: [{ address: "KUNNTFAD3G55IWXSNKTDRKH222E4DF7R", balance: 130833063 }],
  ...overrides,
});

describe('validateAssetInfo', () => {
  it('returns the supply as a string in the smallest units', () => {
    expect(validateAssetInfo(makeInfo(), ASSET, 8)).toBe('289839209');
  });

  it('treats a null supply with no holders as a real zero', () => {
    expect(validateAssetInfo(makeInfo({ supply: null, holders: [] }), ASSET, 8)).toBe('0');
  });

  it('refuses to report zero when the source looks broken', () => {
    // null supply but there are holders — SUM() should not have been empty
    expect(() => validateAssetInfo(makeInfo({ supply: null }), ASSET, 8)).toThrow(/null supply/);

    // no supply field at all
    const { supply, ...withoutSupply } = makeInfo();
    expect(() => validateAssetInfo(withoutSupply, ASSET, 8)).toThrow(/no supply field/);

    expect(() => validateAssetInfo(makeInfo({ supply: 1.5 }), ASSET, 8)).toThrow(/non-integer/);
    expect(() => validateAssetInfo(null, ASSET, 8)).toThrow(/no data/);
  });

  it('rejects a response about a different asset or with unexpected decimals', () => {
    expect(() => validateAssetInfo(makeInfo({ assetUnit: 'other' }), ASSET, 8)).toThrow(/expected/);
    expect(() => validateAssetInfo(makeInfo(), ASSET, 4)).toThrow(/decimals/);
  });

  it('skips the decimals check when the expected value is unknown', () => {
    expect(validateAssetInfo(makeInfo(), ASSET, undefined)).toBe('289839209');
  });
});

describe('getObyteAssetUrl', () => {
  it('encodes the asset id', () => {
    expect(getObyteAssetUrl(ASSET)).toBe(
      'https://explorer.obyte.org/asset/RF%2FysZ%2FZY4leyc3huUq1yFc0xTS0GdeFQu8RmXas4ys%3D'
    );
  });
});

describe('getObyteAssetSupply', () => {
  afterEach(() => {
    delete global.fetch;
    window.localStorage.clear();
  });

  it('requests the asset info endpoint and validates the answer', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => makeInfo(),
    });

    expect(await getObyteAssetSupply(ASSET, 8, { fresh: true })).toBe('289839209');
    expect(global.fetch.mock.calls[0][0]).toContain(`/api/asset/${encodeURIComponent(ASSET)}/info`);
  });

  it('reuses a recent read and persists it for the next page load', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => makeInfo() });

    await getObyteAssetSupply(ASSET, 8, { fresh: true });
    expect(await getObyteAssetSupply(ASSET, 8)).toBe('289839209');
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const stored = JSON.parse(window.localStorage.getItem('cs-obyte-supply-mainnet'));
    expect(stored[ASSET].value).toBe('289839209');
  });

  it('re-reads on an explicit refresh', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => makeInfo() });

    await getObyteAssetSupply(ASSET, 8, { fresh: true });
    await getObyteAssetSupply(ASSET, 8, { fresh: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws on a non-ok response instead of reporting zero, and does not cache the failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 502 });
    await expect(getObyteAssetSupply('failing-asset', 8, { fresh: true })).rejects.toThrow(/502/);

    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => makeInfo({ assetUnit: 'failing-asset' }) });
    expect(await getObyteAssetSupply('failing-asset', 8)).toBe('289839209');
  });
});
