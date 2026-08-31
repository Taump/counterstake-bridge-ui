import { createSlice } from '@reduxjs/toolkit';

// Every amount on the audit page comes from an independent source (one multicall per EVM
// network, the Obyte hub, the Obyte explorer, Oswap and the backend for USD rates), so each
// field carries its own status instead of one status per row. Updates merge into the row — a
// fast EVM totalSupply must not be wiped out by a slower Obyte balance arriving later.
const initialState = {
  rows: {},              // { [bridge_id]: { locked, issued, homeRate, foreignRate } } — each a field
  status: 'idle',        // idle | loading | succeeded | failed
  activeRequestId: null,
  lastUpdated: null,
  error: null,
};

export const EMPTY_FIELD = { status: 'idle', value: null, error: null };

export const hasValue = (field) => field?.value !== null && field?.value !== undefined;

export const auditSlice = createSlice({
  name: 'audit',
  initialState,
  reducers: {
    auditLoadStarted: (state, action) => {
      state.status = 'loading';
      state.activeRequestId = action.payload;
      state.error = null;
    },

    updateAuditRows: (state, action) => {
      const { requestId, updates } = action.payload;

      // a stale request must never overwrite the results of a newer one
      if (state.activeRequestId && requestId !== state.activeRequestId) return;

      for (const { bridge_id, field, status, value = null, error = null } of updates) {
        const row = state.rows[bridge_id] || (state.rows[bridge_id] = {});

        // A refresh must not blank the table: while a field is being re-read we keep the value
        // we already have and only flip its status, so spinners are limited to the very first
        // load, when there is nothing to show yet.
        row[field] = status === 'loading' && hasValue(row[field])
          ? { ...row[field], status }
          : { status, value, error };
      }
    },

    auditLoadFinished: {
      reducer: (state, action) => {
        const { requestId, finishedAt } = action.payload;
        if (state.activeRequestId && requestId !== state.activeRequestId) return;
        state.status = 'succeeded';
        state.lastUpdated = finishedAt;
        state.activeRequestId = null;
      },
      prepare: (requestId) => ({ payload: { requestId, finishedAt: Date.now() } }),
    },

    auditLoadFailed: (state, action) => {
      const { requestId, error } = action.payload;
      if (state.activeRequestId && requestId !== state.activeRequestId) return;
      state.status = 'failed';
      state.error = error;
      state.activeRequestId = null;
    },
  },
});

export const { auditLoadStarted, updateAuditRows, auditLoadFinished, auditLoadFailed } = auditSlice.actions;

export const selectAuditRows = state => state.audit.rows;
export const selectAuditStatus = state => state.audit.status;
export const selectAuditLastUpdated = state => state.audit.lastUpdated;

export default auditSlice.reducer;
