import { compareAmounts } from "./compareAmounts";

describe('compareAmounts', () => {
  it('compares sides with different decimals (18 vs 8)', () => {
    // 3.853 ETH locked on Ethereum vs 2.89839209 ETH issued on Obyte
    const result = compareAmounts({
      locked: '3853000000000000000', lockedDecimals: 18,
      issued: '289839209', issuedDecimals: 8,
    });

    expect(result.scale).toBe(18);
    expect(result.isDeficit).toBe(false);
    expect(result.excess).toBe('954607910000000000'); // 0.95460791 ETH
    expect(result.ratio).toBeCloseTo(0.3294, 3);
  });

  it('compares sides with different decimals (6 vs 4)', () => {
    const result = compareAmounts({
      locked: '17915257933', lockedDecimals: 6,
      issued: '174973443', issuedDecimals: 4,
    });

    expect(result.scale).toBe(6);
    expect(result.isDeficit).toBe(false);
    expect(result.excess).toBe('417913633');
  });

  it('compares sides with different decimals (9 vs 18)', () => {
    const result = compareAmounts({
      locked: '9897492073183', lockedDecimals: 9,
      issued: '9000000000000000000000', issuedDecimals: 18,
    });

    expect(result.scale).toBe(18);
    expect(result.isDeficit).toBe(false);
    expect(result.excess).toBe('897492073183000000000');
  });

  it('detects a deficit that a float comparison would miss', () => {
    // issued is larger than locked by a single smallest unit
    const result = compareAmounts({
      locked: '1000000000000000000', lockedDecimals: 18,
      issued: '100000001', issuedDecimals: 8,
    });

    expect(result.isDeficit).toBe(true);
    expect(result.excess).toBe('-10000000000');
    expect(result.ratio).toBeLessThan(0);
  });

  it('treats equal amounts as no deficit', () => {
    const result = compareAmounts({
      locked: '100000000', lockedDecimals: 8,
      issued: '1000000000000000000', issuedDecimals: 18,
    });

    expect(result.isDeficit).toBe(false);
    expect(result.excess).toBe('0');
    expect(result.ratio).toBe(0);
  });

  it('ranks bridges in different assets by relative excess', () => {
    // 0.955 ETH excess on 2.898 ETH issued is thinner cover than 483 USDC on 17,497 USDC?
    const eth = compareAmounts({ locked: '3853000000000000000', lockedDecimals: 18, issued: '289839209', issuedDecimals: 8 });
    const usdc = compareAmounts({ locked: '17915257933', lockedDecimals: 6, issued: '174973443', issuedDecimals: 4 });

    // the raw excess says USDC is far bigger, the ratio says ETH is far better covered
    expect(eth.ratio).toBeGreaterThan(usdc.ratio);
  });

  it('reports an infinite ratio when nothing is issued', () => {
    expect(compareAmounts({ locked: '1000', lockedDecimals: 8, issued: '0', issuedDecimals: 8 }).ratio).toBe(Infinity);
    expect(compareAmounts({ locked: '0', lockedDecimals: 8, issued: '0', issuedDecimals: 8 }).ratio).toBe(0);
  });

  it('returns null when an amount is missing or malformed', () => {
    const base = { locked: '1', lockedDecimals: 8, issued: '1', issuedDecimals: 8 };

    expect(compareAmounts({ ...base, locked: null })).toBe(null);
    expect(compareAmounts({ ...base, issued: undefined })).toBe(null);
    expect(compareAmounts({ ...base, locked: 'x' })).toBe(null);
    expect(compareAmounts({ ...base, lockedDecimals: undefined })).toBe(null);
    expect(compareAmounts({ ...base, issuedDecimals: -1 })).toBe(null);
  });
});
