import { BigNumber, ethers } from "ethers";

const addThousandsSeparators = (integerPart) => integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const trimTrailingZeros = (str) => str.includes(".") ? str.replace(/0+$/, "").replace(/\.$/, "") : str;

/**
 * Formats a raw on-chain amount for display without ever converting it to a JS Number.
 *
 * `full` keeps every digit the chain reported, `display` is truncated (never rounded up, so
 * we can't overstate a balance) to `max_decimals` fraction digits. When the value is non-zero
 * but too small to show, `display` becomes "<0.00001" rather than a misleading "0".
 *
 * @param {string|number|BigNumber} raw - amount in the smallest units
 * @param {number} decimals
 * @param {number} max_decimals - fraction digits to show
 * @returns {{ display: string, full: string, isTruncated: boolean } | null} null if raw is not an integer amount
 */
export const formatAmount = (raw, decimals = 0, max_decimals = 5) => {
  if (raw === null || raw === undefined || raw === "") return null;

  let value;
  try {
    value = BigNumber.from(typeof raw === "number" ? String(raw) : raw);
  } catch (e) {
    return null;
  }

  const full = trimTrailingZeros(ethers.utils.formatUnits(value, decimals));
  const isNegative = full.startsWith("-");
  const unsigned = isNegative ? full.slice(1) : full;
  const [integerPart, fractionPart = ""] = unsigned.split(".");

  const truncatedFraction = fractionPart.slice(0, max_decimals).replace(/0+$/, "");
  const isTruncated = truncatedFraction !== fractionPart;

  const sign = isNegative ? "-" : "";
  let display = truncatedFraction
    ? `${sign}${addThousandsSeparators(integerPart)}.${truncatedFraction}`
    : `${sign}${addThousandsSeparators(integerPart)}`;

  // non-zero, but everything we would show got truncated away
  if (!value.isZero() && integerPart === "0" && !truncatedFraction) {
    display = max_decimals > 0
      ? `${sign}<0.${"0".repeat(max_decimals - 1)}1`
      : `${sign}<1`;
  }

  return { display, full, isTruncated };
}

const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export const formatUsd = (value) => usdFormatter.format(value);
