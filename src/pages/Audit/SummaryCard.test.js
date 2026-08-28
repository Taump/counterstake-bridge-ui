import ReactDOM from "react-dom";
import { act } from "react-dom/test-utils";

import { SummaryCard } from "./SummaryCard";

const render = (props) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => { ReactDOM.render(<SummaryCard title="Issued" value="$1,000" footnote="image tokens held by users" {...props} />, container); });
  return container;
};

describe('SummaryCard', () => {
  it('shows skeletons instead of a value while there is nothing to sum yet', () => {
    const c = render({ loading: true });
    expect(c.querySelectorAll('.ant-skeleton').length).toBe(2);
    expect(c.textContent).not.toContain('$1,000');
  });

  it('marks a value that is still growing with a dimmed number and a spinner', () => {
    const c = render({ settling: true, footnote: '12/23 bridges in so far' });
    expect(c.textContent).toContain('$1,000');
    expect(c.querySelector('[class*="cardValue"]').style.opacity).toBe('0.6');
    expect(c.querySelector('.anticon-loading')).not.toBe(null);
    expect(c.textContent).toContain('12/23 bridges in so far');
  });

  it('shows the final value plainly once the load is done', () => {
    const c = render({});
    expect(c.textContent).toContain('$1,000');
    expect(c.querySelector('[class*="cardValue"]').style.opacity).toBe('');
    expect(c.querySelector('.anticon-loading')).toBe(null);
    expect(c.querySelector('.ant-skeleton')).toBe(null);
  });
});
