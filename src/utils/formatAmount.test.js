import { formatAmount } from "./formatAmount";

describe('formatAmount', () => {
  it('formats amounts with the decimals of each side of a bridge', () => {
    // ETH is 18 decimals on Ethereum and 8 on Obyte
    expect(formatAmount('3853000000000000000', 18).display).toBe('3.853');
    expect(formatAmount('289839209', 8).display).toBe('2.89839');
    expect(formatAmount('289839209', 8).full).toBe('2.89839209');

    // USDC is 6 and 4
    expect(formatAmount('17915257933', 6).display).toBe('17,915.25793');
    expect(formatAmount('174973443', 4).display).toBe('17,497.3443');

    // GBYTE is 9 and 18
    expect(formatAmount('9897492073183', 9).display).toBe('9,897.49207');
  });

  it('keeps full precision that a float would lose', () => {
    const raw = '1234567890123456789'; // 1.234567890123456789 with 18 decimals
    expect(formatAmount(raw, 18).full).toBe('1.234567890123456789');
    expect(formatAmount(raw, 18).display).toBe('1.23456');
    expect(formatAmount(raw, 18).isTruncated).toBe(true);

    // a value that Number() rounds off entirely
    expect(formatAmount('9007199254740993', 0).full).toBe('9007199254740993');
  });

  it('does not report a non-zero amount as zero', () => {
    expect(formatAmount('1', 18).display).toBe('<0.00001');
    expect(formatAmount('-1', 18).display).toBe('-<0.00001');
  });

  it('handles zero, negatives and trailing zeros', () => {
    expect(formatAmount('0', 8)).toEqual({ display: '0', full: '0', isTruncated: false });
    expect(formatAmount('100000000', 8).display).toBe('1');
    expect(formatAmount('-500000000', 8).display).toBe('-5');
    expect(formatAmount('-1234500000', 8).display).toBe('-12.345');
  });

  it('returns null for missing or malformed input', () => {
    expect(formatAmount(null, 8)).toBe(null);
    expect(formatAmount(undefined, 8)).toBe(null);
    expect(formatAmount('', 8)).toBe(null);
    expect(formatAmount('not a number', 8)).toBe(null);
    expect(formatAmount('1.5', 8)).toBe(null);
  });

  it('accepts a custom number of displayed decimals', () => {
    expect(formatAmount('289839209', 8, 2).display).toBe('2.89');
    expect(formatAmount('289839209', 8, 2).isTruncated).toBe(true);
  });
});
