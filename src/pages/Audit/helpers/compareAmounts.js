import { BigNumber, ethers } from "ethers";

/**
 * Compares the export-side balance with the import-side supply.
 *
 * The two sides can use different decimals (ETH is 18 on Ethereum and 8 on Obyte,
 * USDC is 6 and 4), so both amounts are brought to a common scale as integers —
 * no float arithmetic is involved.
 *
 * `ratio` is the excess as a share of the issued amount. It is dimensionless, so bridges
 * holding different assets can be ranked against each other without knowing any prices —
 * negative means a deficit, and Infinity means nothing is issued at all. It is a sort key
 * only; the deficit verdict itself comes from the integer comparison.
 *
 * @returns {{ scale: number, excess: string, isDeficit: boolean, ratio: number } | null} null
 *   if either amount is missing or malformed. `excess` is in the smallest units of `scale`.
 */
export const compareAmounts = ({ locked, lockedDecimals, issued, issuedDecimals }) => {
  if (locked === null || locked === undefined || issued === null || issued === undefined) return null;
  if (!Number.isInteger(lockedDecimals) || !Number.isInteger(issuedDecimals)) return null;
  if (lockedDecimals < 0 || issuedDecimals < 0) return null;

  let lockedAmount, issuedAmount;
  try {
    lockedAmount = BigNumber.from(typeof locked === "number" ? String(locked) : locked);
    issuedAmount = BigNumber.from(typeof issued === "number" ? String(issued) : issued);
  } catch (e) {
    return null;
  }

  const scale = Math.max(lockedDecimals, issuedDecimals);
  const scaledLocked = lockedAmount.mul(BigNumber.from(10).pow(scale - lockedDecimals));
  const scaledIssued = issuedAmount.mul(BigNumber.from(10).pow(scale - issuedDecimals));

  const excess = scaledLocked.sub(scaledIssued);
  const toFloat = (amount) => parseFloat(ethers.utils.formatUnits(amount, scale));
  const issuedFloat = toFloat(scaledIssued);
  const excessFloat = toFloat(excess);

  return {
    scale,
    excess: excess.toString(),
    isDeficit: scaledIssued.gt(scaledLocked),
    ratio: issuedFloat === 0 ? (excessFloat === 0 ? 0 : Infinity) : excessFloat / issuedFloat,
  };
}
