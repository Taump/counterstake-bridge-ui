import { createAsyncThunk } from "@reduxjs/toolkit";

import { getEvmAuditAmounts, getObyteLockedAmount } from "utils/getAuditAmounts";
import { getObyteAssetSupply } from "utils/getObyteAssetSupply";
import { getTokenPricesInUsd, priceKey } from "services/prices";
import { promiseAllWithConcurrency } from "utils/promiseAllWithConcurrency";

import { auditLoadFailed, auditLoadFinished, auditLoadStarted, updateAuditRows } from "../auditSlice";
import { selectSupportedBridges } from "../bridgesSlice";

// The numbers move slowly enough that a manual Refresh covers the times you need them now.
export const AUDIT_TTL = 30 * 60 * 1000; // 30 minutes

// The explorer runs these queries in parallel, so the batch costs about as much as its slowest
// query rather than their sum. Measured over all 17 Obyte assets: 27s at 5, 13.8s at 8, 12.2s at
// 17 — so 8 buys almost all of it without opening 17 heavy queries on someone else's server.
const EXPLORER_CONCURRENCY = 8;
const OBYTE_CONCURRENCY = 10;

export const loadAuditData = createAsyncThunk(
  'audit/loadAuditData',
  async (arg, thunkAPI) => {
    const { dispatch, getState, requestId } = thunkAPI;
    const fresh = !!arg?.force;

    const bridges = selectSupportedBridges(getState());

    dispatch(auditLoadStarted(requestId));

    const emit = (updates) => dispatch(updateAuditRows({ requestId, updates: [].concat(updates) }));

    try {
      emit(bridges.flatMap(({ bridge_id }) => (
        ['locked', 'issued', 'homeRate', 'foreignRate'].map(field => ({ bridge_id, field, status: 'loading' }))
      )));

      const evmNetworks = [...new Set(
        bridges.flatMap(({ home_network, foreign_network }) => [home_network, foreign_network])
      )].filter(network => network !== 'Obyte');

      // One logical multicall per EVM network. getEvmAuditAmounts() never throws, so a dead
      // network can't take the other networks or the Obyte reads down with it.
      const evmStage = Promise.all(evmNetworks.map(network =>
        getEvmAuditAmounts(network, bridges).then(emit)
      ));

      const obyteLockedStage = promiseAllWithConcurrency(
        bridges
          .filter(({ home_network }) => home_network === 'Obyte')
          .map(bridge => () => getObyteLockedAmount(bridge).then(emit)),
        OBYTE_CONCURRENCY
      );

      // A cold asset can take the explorer 10–20s, so each result is emitted as soon as it
      // arrives instead of waiting for the whole batch.
      const obyteIssuedStage = promiseAllWithConcurrency(
        bridges
          .filter(({ foreign_network }) => foreign_network === 'Obyte')
          .map(({ bridge_id, foreign_asset, foreign_asset_decimals }) => () =>
            getObyteAssetSupply(foreign_asset, foreign_asset_decimals, { fresh })
              .then(value => emit({ bridge_id, field: 'issued', status: 'succeeded', value }))
              .catch(e => {
                console.log(`audit: failed to get supply of ${foreign_asset}`, e);
                return emit({ bridge_id, field: 'issued', status: 'failed', error: e.message });
              })
          ),
        EXPLORER_CONCURRENCY
      );

      // Each side of a bridge is priced on its own: an image token on Obyte is worth what it
      // trades for there, which can differ from the home asset's global price.
      const sides = bridges.flatMap(({ bridge_id, home_asset, home_network, foreign_asset, foreign_network }) => [
        { bridge_id, field: 'homeRate', asset: home_asset, network: home_network },
        { bridge_id, field: 'foreignRate', asset: foreign_asset, network: foreign_network },
      ]);

      const rateStage = getTokenPricesInUsd(sides, { fresh })
        .then(rates => emit(sides.map(({ bridge_id, field, asset, network }) => {
          const rate = rates[priceKey(asset, network)];
          return rate
            ? { bridge_id, field, status: 'succeeded', value: rate }
            : { bridge_id, field, status: 'failed', error: 'no price for this asset' };
        })))
        .catch(e => {
          console.log('audit: failed to get USD rates', e);
          return emit(sides.map(({ bridge_id, field }) => ({ bridge_id, field, status: 'failed', error: e.message })));
        });

      await Promise.all([evmStage, obyteLockedStage, obyteIssuedStage, rateStage]);

      dispatch(auditLoadFinished(requestId));
    } catch (e) {
      console.log('audit: load failed', e);
      dispatch(auditLoadFailed({ requestId, error: e.message }));
      throw e;
    }
  },
  {
    condition: (arg, { getState }) => {
      const { bridges, audit } = getState();

      // Never run on an empty list: the empty pass would set a fresh lastUpdated and the TTL
      // would then block the real load for the whole TTL. The list, not the status, is the
      // test — during the periodic bridges poll the status flips to 'loading' while the items
      // stay, and a refresh arriving in that window must not be lost.
      if (!bridges.items.length) return false;
      if (audit.status === 'loading') return false;
      if (arg?.force) return true;

      // a bridge we have no row for yet must be loaded regardless of the TTL
      if (selectSupportedBridges(getState()).some(({ bridge_id }) => !audit.rows[bridge_id])) return true;

      return !audit.lastUpdated || Date.now() - audit.lastUpdated >= AUDIT_TTL;
    },
  }
);
