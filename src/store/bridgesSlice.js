import { createSelector, createSlice } from '@reduxjs/toolkit';

import { filterBridgesByNetworks } from 'utils/filterBridgesByNetworks';

// The raw /bridges response. updateBridges() derives directions/inputs from it and throws the
// list itself away, but the audit page needs the original fields (both AAs, both decimals).
// The status matters too: the audit load must not start on an empty list, otherwise an empty
// pass would set a fresh lastUpdated and block the real load for the whole TTL.
const initialState = {
  items: [],
  status: 'idle', // idle | loading | succeeded | failed
  error: null,
};

export const bridgesSlice = createSlice({
  name: 'bridges',
  initialState,
  reducers: {
    setBridgesLoading: (state) => {
      state.status = 'loading';
      state.error = null;
    },
    setBridges: (state, action) => {
      state.items = action.payload;
      state.status = 'succeeded';
      state.error = null;
    },
    setBridgesFailed: (state, action) => {
      state.status = 'failed';
      state.error = action.payload || 'failed to load bridges';
    },
  },
});

export const { setBridgesLoading, setBridges, setBridgesFailed } = bridgesSlice.actions;

export const selectBridges = state => state.bridges.items;
export const selectBridgesStatus = state => state.bridges.status;

// Bridges on networks this build can talk to — the one list the audit page works from.
export const selectSupportedBridges = createSelector([selectBridges], filterBridgesByNetworks);

export default bridgesSlice.reducer;
