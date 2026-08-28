import ReactDOM from "react-dom";
import { act } from "react-dom/test-utils";

import { hasValue } from "store/auditSlice";
import { AmountCell } from "./AmountCell";

const render = (props) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => { ReactDOM.render(<AmountCell {...props} />, container); });
  return container;
};

const field = (status, value = null, error = null) => ({ status, value, error });

describe('AmountCell', () => {
  it('shows a skeleton only while there is nothing to show yet', () => {
    expect(render({ field: field('idle'), decimals: 8 }).querySelector('.ant-skeleton')).not.toBe(null);
    expect(render({ field: field('loading'), decimals: 8 }).querySelector('.ant-skeleton')).not.toBe(null);
  });

  it('keeps showing the previous amount while it is being re-read', () => {
    const container = render({ field: field('loading', '289839209'), decimals: 8, symbol: 'ETH', usd: 7000 });

    expect(container.querySelector('.ant-skeleton')).toBe(null);
    expect(container.textContent).toContain('2.89839');
    expect(container.textContent).toContain('$7,000');
  });

  it('shows n/a with the reason when the read failed', () => {
    const container = render({ field: field('failed', null, 'explorer timed out'), decimals: 8 });

    expect(container.textContent).toContain('n/a');
    expect(container.querySelector('.ant-skeleton')).toBe(null);
  });
});

describe('hasValue', () => {
  it('tells a real zero from a missing value', () => {
    expect(hasValue({ value: '0' })).toBe(true);
    expect(hasValue({ value: 0 })).toBe(true);
    expect(hasValue({ value: null })).toBe(false);
    expect(hasValue(undefined)).toBe(false);
  });
});
