import { Skeleton, Tooltip } from "antd";

import { hasValue } from "store/auditSlice";
import { formatAmount, formatUsd } from "utils/formatAmount";

/**
 * A formatted amount with its symbol and, underneath, its USD estimate — the shape every
 * numeric column shares. The full-precision value is one hover away when the display had
 * to be truncated.
 */
export const Amount = ({ raw, decimals, symbol, usd, color }) => {
  const amount = formatAmount(raw, decimals, 5);
  if (!amount) return <span style={{ opacity: .7 }}>—</span>;

  const value = amount.isTruncated
    ? <Tooltip title={`${amount.full} ${symbol || ''}`.trim()}>{amount.display}</Tooltip>
    : amount.display;

  return (
    <div>
      <div style={color ? { color } : undefined}>{value} <span style={{ opacity: .7 }}>{symbol}</span></div>
      <div style={{ fontSize: 12, opacity: .5 }}>{usd === null || usd === undefined ? 'n/a' : formatUsd(usd)}</div>
    </div>
  );
}

// Two bars in place of the two lines a cell will have. Each bar sits in a box the exact height
// of the text line it stands in for (22px amount line, 19px USD line), so a row measures the
// same whether it shows a skeleton or a number and nothing jumps when the value arrives.
export const AmountSkeleton = () => (
  <div>
    <div style={{ height: 22, display: 'flex', alignItems: 'center' }}>
      <Skeleton.Input active size="small" style={{ width: 110, height: 14 }} />
    </div>
    <div style={{ height: 19, display: 'flex', alignItems: 'center' }}>
      <Skeleton.Input active size="small" style={{ width: 60, height: 10 }} />
    </div>
  </div>
);

/**
 * One amount cell bound to a field of the audit store: a skeleton only while there is nothing
 * to show yet, "n/a" (never "0" and never "$0") when the source failed, and the value otherwise
 * — including while it is being re-read, so a refresh replaces numbers instead of emptying the table.
 */
export const AmountCell = ({ field, decimals, symbol, usd, fallbackUrl }) => {
  if (!hasValue(field) && (field.status === 'idle' || field.status === 'loading'))
    return <AmountSkeleton />;

  if (field.status === 'failed') {
    const label = <span style={{ opacity: .7, borderBottom: '1px dashed #434343', cursor: 'help' }}>n/a</span>;
    const withTooltip = <Tooltip title={field.error || 'could not read this value'}>{label}</Tooltip>;
    return fallbackUrl
      ? <span>{withTooltip} <a href={fallbackUrl} target="_blank" rel="noopener noreferrer">check</a></span>
      : withTooltip;
  }

  return <Amount raw={field.value} decimals={decimals} symbol={symbol} usd={usd} />;
}
