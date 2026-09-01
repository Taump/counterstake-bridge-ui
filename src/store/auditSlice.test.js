import reducer, { auditLoadFinished, auditLoadStarted, updateAuditRows } from "./auditSlice";

const started = (requestId) => reducer(undefined, auditLoadStarted(requestId));

describe('auditSlice', () => {
  it('merges fields of the same row instead of replacing it', () => {
    let state = started('req-1');

    // a fast EVM totalSupply arrives first
    state = reducer(state, updateAuditRows({
      requestId: 'req-1',
      updates: [{ bridge_id: 1, field: 'issued', status: 'succeeded', value: '289839209' }],
    }));

    // then a slower Obyte balance for the same bridge
    state = reducer(state, updateAuditRows({
      requestId: 'req-1',
      updates: [{ bridge_id: 1, field: 'locked', status: 'succeeded', value: '3853000000000000000' }],
    }));

    expect(state.rows[1].issued.value).toBe('289839209');
    expect(state.rows[1].locked.value).toBe('3853000000000000000');
  });

  it('keeps a failed field independent from a successful one', () => {
    let state = started('req-1');

    state = reducer(state, updateAuditRows({
      requestId: 'req-1',
      updates: [
        { bridge_id: 1, field: 'locked', status: 'succeeded', value: '10' },
        { bridge_id: 1, field: 'issued', status: 'failed', error: 'explorer timed out' },
      ],
    }));

    expect(state.rows[1].locked).toMatchObject({ status: 'succeeded', value: '10', error: null });
    expect(state.rows[1].issued).toMatchObject({ status: 'failed', value: null, error: 'explorer timed out' });
  });

  it('keeps the previous value on screen while it is being re-read', () => {
    let state = started('req-1');
    state = reducer(state, updateAuditRows({
      requestId: 'req-1',
      updates: [{ bridge_id: 1, field: 'locked', status: 'succeeded', value: '10' }],
    }));

    // a refresh starts and marks everything as loading
    state = reducer(state, auditLoadStarted('req-2'));
    state = reducer(state, updateAuditRows({
      requestId: 'req-2',
      updates: [{ bridge_id: 1, field: 'locked', status: 'loading' }],
    }));

    expect(state.rows[1].locked).toMatchObject({ status: 'loading', value: '10' });

    state = reducer(state, updateAuditRows({
      requestId: 'req-2',
      updates: [{ bridge_id: 1, field: 'locked', status: 'succeeded', value: '11' }],
    }));
    expect(state.rows[1].locked.value).toBe('11');
  });

  it('has nothing to keep on the very first load', () => {
    let state = started('req-1');
    state = reducer(state, updateAuditRows({
      requestId: 'req-1',
      updates: [{ bridge_id: 1, field: 'locked', status: 'loading' }],
    }));

    expect(state.rows[1].locked).toMatchObject({ status: 'loading', value: null });
  });

  it('does not keep a value that failed to read', () => {
    let state = started('req-1');
    state = reducer(state, updateAuditRows({
      requestId: 'req-1',
      updates: [{ bridge_id: 1, field: 'issued', status: 'succeeded', value: '10' }],
    }));
    state = reducer(state, updateAuditRows({
      requestId: 'req-1',
      updates: [{ bridge_id: 1, field: 'issued', status: 'failed', error: 'explorer timed out' }],
    }));

    expect(state.rows[1].issued).toMatchObject({ status: 'failed', value: null, error: 'explorer timed out' });
  });

  it('ignores updates from a superseded request', () => {
    let state = started('req-1');
    state = reducer(state, updateAuditRows({
      requestId: 'req-1',
      updates: [{ bridge_id: 1, field: 'locked', status: 'succeeded', value: '10' }],
    }));

    // a newer load starts while the old one is still in flight
    state = reducer(state, auditLoadStarted('req-2'));

    state = reducer(state, updateAuditRows({
      requestId: 'req-1',
      updates: [{ bridge_id: 1, field: 'locked', status: 'succeeded', value: 'stale' }],
    }));

    expect(state.rows[1].locked.value).toBe('10');

    state = reducer(state, updateAuditRows({
      requestId: 'req-2',
      updates: [{ bridge_id: 1, field: 'locked', status: 'succeeded', value: '20' }],
    }));

    expect(state.rows[1].locked.value).toBe('20');
  });

  it('only lets the active request finish the load', () => {
    let state = started('req-1');
    state = reducer(state, auditLoadStarted('req-2'));

    state = reducer(state, auditLoadFinished('req-1'));
    expect(state.status).toBe('loading');
    expect(state.lastUpdated).toBe(null);

    state = reducer(state, auditLoadFinished('req-2'));
    expect(state.status).toBe('succeeded');
    expect(state.lastUpdated).toEqual(expect.any(Number));
    expect(state.activeRequestId).toBe(null);
  });
});
