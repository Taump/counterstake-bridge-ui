import { configureStore } from "@reduxjs/toolkit";

import auditReducer from "../auditSlice";
import bridgesReducer, { setBridges, setBridgesFailed, setBridgesLoading } from "../bridgesSlice";
import { AUDIT_TTL, loadAuditData } from "./loadAuditData";

jest.mock("utils/getAuditAmounts", () => ({
  getEvmAuditAmounts: jest.fn(),
  getObyteLockedAmount: jest.fn(),
}));

jest.mock("utils/getObyteAssetSupply", () => ({
  getObyteAssetSupply: jest.fn(),
}));

jest.mock("services/prices", () => ({
  ...jest.requireActual("services/prices/priceKey"),
  getTokenPricesInUsd: jest.fn(),
}));

const { getEvmAuditAmounts, getObyteLockedAmount } = require("utils/getAuditAmounts");
const { getObyteAssetSupply } = require("utils/getObyteAssetSupply");
const { getTokenPricesInUsd, priceKey } = require("services/prices");

const EXPATRIATION = {
  bridge_id: 1,
  home_network: 'Ethereum', home_asset: '0x0000000000000000000000000000000000000000',
  home_asset_decimals: 18, home_symbol: 'ETH', export_aa: '0x74aF8A878317E0F6e72e302FbcDF5f3009186398',
  foreign_network: 'Obyte', foreign_asset: 'RF/ysZ/ZY4leyc3huUq1yFc0xTS0GdeFQu8RmXas4ys=',
  foreign_asset_decimals: 8, foreign_symbol: 'ETH', import_aa: 'UUHRSJZOQK25ICZRLPN3I2TGSDZSUM2A',
};

const REPATRIATION = {
  bridge_id: 2,
  home_network: 'Obyte', home_asset: 'base',
  home_asset_decimals: 9, home_symbol: 'GBYTE', export_aa: 'H2SVLDNYWYI3ISCQYH5VSTOTQBJ7PZSU',
  foreign_network: 'Ethereum', foreign_asset: '0x31F69dE127C8A0fF10819C0955490a4Ae46fcc2a',
  foreign_asset_decimals: 18, foreign_symbol: 'GBYTE', import_aa: '0x31F69dE127C8A0fF10819C0955490a4Ae46fcc2a',
};

const UNSUPPORTED = { ...EXPATRIATION, bridge_id: 3, home_network: 'Solana' };

const makeStore = () => configureStore({ reducer: { bridges: bridgesReducer, audit: auditReducer } });

const succeededField = (bridge_id, field, value) => ({ bridge_id, field, status: 'succeeded', value });

beforeEach(() => {
  jest.clearAllMocks();
  getEvmAuditAmounts.mockResolvedValue([]);
  getObyteLockedAmount.mockImplementation(async ({ bridge_id }) => succeededField(bridge_id, 'locked', '0'));
  getObyteAssetSupply.mockResolvedValue('0');
  // every side priced at 1 unless a test says otherwise
  getTokenPricesInUsd.mockImplementation(async (pairs) => Object.fromEntries(pairs.map(({ asset, network }) => [priceKey(asset, network), 1])));
});

describe('loadAuditData condition', () => {
  it('does not run while the bridges list is still loading', async () => {
    const store = makeStore();
    store.dispatch(setBridgesLoading());

    const result = await store.dispatch(loadAuditData());

    expect(result.meta.condition).toBe(true);
    expect(getEvmAuditAmounts).not.toHaveBeenCalled();
    // an empty pass must not look like a fresh load, or the TTL would block the real one
    expect(store.getState().audit.lastUpdated).toBe(null);
    expect(store.getState().audit.status).toBe('idle');
  });

  it('does not run on a failed or empty bridges list', async () => {
    const store = makeStore();
    store.dispatch(setBridgesFailed('backend is down'));
    expect((await store.dispatch(loadAuditData())).meta.condition).toBe(true);

    store.dispatch(setBridges([]));
    expect((await store.dispatch(loadAuditData())).meta.condition).toBe(true);
    expect(store.getState().audit.lastUpdated).toBe(null);
  });

  it('runs once the bridges list arrives after the page has mounted', async () => {
    const store = makeStore();

    // the page mounts first and gets skipped
    expect((await store.dispatch(loadAuditData())).meta.condition).toBe(true);

    store.dispatch(setBridges([EXPATRIATION, REPATRIATION]));
    await store.dispatch(loadAuditData());

    expect(store.getState().audit.status).toBe('succeeded');
    expect(store.getState().audit.lastUpdated).toEqual(expect.any(Number));
  });

  it('skips a repeat load within the TTL but not a forced one', async () => {
    const store = makeStore();
    store.dispatch(setBridges([EXPATRIATION, REPATRIATION]));
    await store.dispatch(loadAuditData());

    getObyteAssetSupply.mockClear();
    getTokenPricesInUsd.mockClear();
    expect((await store.dispatch(loadAuditData())).meta.condition).toBe(true);
    expect(getObyteAssetSupply).not.toHaveBeenCalled();

    await store.dispatch(loadAuditData({ force: true }));
    // a manual refresh must not be answered from any cache — neither prices nor supplies
    expect(getObyteAssetSupply).toHaveBeenCalledWith(expect.any(String), expect.any(Number), { fresh: true });
    expect(getTokenPricesInUsd).toHaveBeenCalledWith(expect.any(Array), { fresh: true });
  });

  it('loads a newly added bridge even inside the TTL', async () => {
    const store = makeStore();
    store.dispatch(setBridges([EXPATRIATION]));
    await store.dispatch(loadAuditData());

    const lastUpdated = store.getState().audit.lastUpdated;
    expect(Date.now() - lastUpdated).toBeLessThan(AUDIT_TTL);

    store.dispatch(setBridges([EXPATRIATION, REPATRIATION]));
    const result = await store.dispatch(loadAuditData());

    expect(result.meta.condition).toBeUndefined();
    expect(store.getState().audit.rows[2]).toBeDefined();
  });
});

describe('loadAuditData', () => {
  it('fills every field of every supported bridge', async () => {
    getEvmAuditAmounts.mockImplementation(async (network, bridges) => {
      expect(network).toBe('Ethereum');
      expect(bridges.map(b => b.bridge_id)).toEqual([1, 2]);
      return [
        succeededField(1, 'locked', '3853000000000000000'),
        succeededField(2, 'issued', '9000000000000000000000'),
      ];
    });
    getObyteLockedAmount.mockResolvedValue(succeededField(2, 'locked', '9897492073183'));
    getObyteAssetSupply.mockResolvedValue('289839209');
    getTokenPricesInUsd.mockResolvedValue({
      [priceKey(EXPATRIATION.home_asset, 'Ethereum')]: 2500,
      [priceKey(EXPATRIATION.foreign_asset, 'Obyte')]: 2438,
      [priceKey('base', 'Obyte')]: 4.99,
      [priceKey(REPATRIATION.foreign_asset, 'Ethereum')]: 5.1,
    });

    const store = makeStore();
    store.dispatch(setBridges([EXPATRIATION, REPATRIATION, UNSUPPORTED]));
    await store.dispatch(loadAuditData());

    const { rows } = store.getState().audit;

    expect(rows[1].locked).toMatchObject({ status: 'succeeded', value: '3853000000000000000' });
    expect(rows[1].issued).toMatchObject({ status: 'succeeded', value: '289839209' });
    expect(rows[2].locked).toMatchObject({ status: 'succeeded', value: '9897492073183' });
    expect(rows[2].issued).toMatchObject({ status: 'succeeded', value: '9000000000000000000000' });
    expect(rows[1].homeRate).toMatchObject({ status: 'succeeded', value: 2500 });
    expect(rows[1].foreignRate).toMatchObject({ status: 'succeeded', value: 2438 }); // the Obyte image has its own price
    expect(rows[2].homeRate).toMatchObject({ status: 'succeeded', value: 4.99 });
    expect(rows[2].foreignRate).toMatchObject({ status: 'succeeded', value: 5.1 });

    // the bridge on an unsupported network is left out entirely
    expect(rows[3]).toBeUndefined();
  });

  it('marks fields as loading before their sources answer', async () => {
    let resolveSupply;
    getObyteAssetSupply.mockReturnValue(new Promise(resolve => { resolveSupply = resolve; }));

    const store = makeStore();
    store.dispatch(setBridges([EXPATRIATION]));
    const pending = store.dispatch(loadAuditData());

    expect(store.getState().audit.rows[1].issued.status).toBe('loading');

    resolveSupply('289839209');
    await pending;

    expect(store.getState().audit.rows[1].issued.status).toBe('succeeded');
  });

  it('reports an unknown rate as failed rather than a zero price', async () => {
    getTokenPricesInUsd.mockImplementation(async (pairs) => Object.fromEntries(pairs.map(({ asset, network }) => [priceKey(asset, network), null]))); // nobody has a rate

    const store = makeStore();
    store.dispatch(setBridges([EXPATRIATION]));
    await store.dispatch(loadAuditData());

    expect(store.getState().audit.rows[1].homeRate).toMatchObject({ status: 'failed', value: null });
    expect(store.getState().audit.rows[1].foreignRate).toMatchObject({ status: 'failed', value: null });
  });

  it('isolates a failing source from the others', async () => {
    getObyteAssetSupply.mockRejectedValue(new Error('explorer timed out'));
    getEvmAuditAmounts.mockResolvedValue([succeededField(1, 'locked', '3853000000000000000')]);

    const store = makeStore();
    store.dispatch(setBridges([EXPATRIATION]));
    await store.dispatch(loadAuditData());

    const { rows, status } = store.getState().audit;
    expect(status).toBe('succeeded');
    expect(rows[1].locked.status).toBe('succeeded');
    expect(rows[1].issued).toMatchObject({ status: 'failed', error: 'explorer timed out' });
  });
});
