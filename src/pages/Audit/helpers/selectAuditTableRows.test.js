import { selectAuditTableRows, selectAuditTotals } from "./selectAuditTableRows";

// ETH: Ethereum → Obyte. Locked 2 ETH on Ethereum, 1 ETH image issued on Obyte.
const BRIDGE = {
  bridge_id: 1,
  home_network: 'Ethereum', home_asset: '0x0000000000000000000000000000000000000000', home_asset_decimals: 18, home_symbol: 'ETH',
  foreign_network: 'Obyte', foreign_asset: 'RF/ysZ/ZY4leyc3huUq1yFc0xTS0GdeFQu8RmXas4ys=', foreign_asset_decimals: 8, foreign_symbol: 'ETH',
};

const ok = (value) => ({ status: 'succeeded', value, error: null });
const failed = { status: 'failed', value: null, error: 'no price for this asset' };

const state = (row) => ({ bridges: { items: [BRIDGE] }, audit: { rows: { 1: row } } });

describe('selectAuditTableRows', () => {
  it('prices each side with its own rate', () => {
    const [row] = selectAuditTableRows(state({
      locked: ok('2000000000000000000'), issued: ok('100000000'),
      homeRate: ok(2500), foreignRate: ok(2400),
    }));

    expect(row.lockedInUsd).toBe(5000);   // 2 ETH at the home rate
    expect(row.issuedInUsd).toBe(2400);   // 1 ETH image at the Obyte rate
    expect(row.isPriced).toBe(true);
  });

  it('values the excess at the home rate, keeping the sign of the token amount', () => {
    const [row] = selectAuditTableRows(state({
      locked: ok('2000000000000000000'), issued: ok('100000000'),
      homeRate: ok(2500), foreignRate: ok(9999),
    }));

    expect(row.comparison.isDeficit).toBe(false);
    expect(row.excessInUsd).toBe(2500); // 1 ETH of surplus
  });

  it('shows what it can when only one side is priced, but does not count the bridge as priced', () => {
    const [row] = selectAuditTableRows(state({
      locked: ok('2000000000000000000'), issued: ok('100000000'),
      homeRate: failed, foreignRate: ok(2400),
    }));

    expect(row.lockedInUsd).toBe(null);
    expect(row.issuedInUsd).toBe(2400);
    expect(row.isPriced).toBe(false);
  });

  it('keeps the comparison available while a rate is missing', () => {
    const [row] = selectAuditTableRows(state({ locked: ok('2000000000000000000'), issued: ok('100000000') }));
    expect(row.comparison).not.toBe(null);
    expect(row.excessInUsd).toBe(null);
  });
});

describe('selectAuditTotals', () => {
  it('sums only bridges priced on both sides', () => {
    const fully = { locked: ok('2000000000000000000'), issued: ok('100000000'), homeRate: ok(2500), foreignRate: ok(2400) };
    const half = { locked: ok('2000000000000000000'), issued: ok('100000000'), homeRate: ok(2500), foreignRate: failed };
    const second = { ...BRIDGE, bridge_id: 2 };

    const totals = selectAuditTotals({ bridges: { items: [BRIDGE, second] }, audit: { rows: { 1: fully, 2: half } } });

    // 1 ETH of surplus at the home rate — not locked$ minus issued$
    expect(totals).toEqual({ lockedInUsd: 5000, issuedInUsd: 2400, excessInUsd: 2500, priced: 1, total: 2 });
  });
});

describe('sumRows', () => {
  const { sumRows } = require("./selectAuditTableRows");
  const priced = (lockedInUsd, issuedInUsd, excessInUsd) => ({ isPriced: true, lockedInUsd, issuedInUsd, excessInUsd });
  const unpriced = { isPriced: false, lockedInUsd: null, issuedInUsd: 5, excessInUsd: 5 };

  it('sums each column of the priced rows on its own', () => {
    expect(sumRows([priced(100, 60, 35), priced(50, 70, -15), unpriced])).toEqual({
      lockedInUsd: 150, issuedInUsd: 130, excessInUsd: 20, priced: 2, total: 3,
    });
  });

  it('gives an empty total for no rows', () => {
    expect(sumRows([])).toEqual({ lockedInUsd: 0, issuedInUsd: 0, excessInUsd: 0, priced: 0, total: 0 });
  });
});
