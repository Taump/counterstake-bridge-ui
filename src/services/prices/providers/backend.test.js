import { indexBackendRates } from "./backend";
import { priceKey } from "../priceKey";

const GBYTE_BRIDGE = {
  bridge_id: 2,
  home_network: 'Obyte', home_asset: 'base',
  foreign_network: 'Ethereum', foreign_asset: '0x31F69dE127C8A0fF10819C0955490a4Ae46fcc2a',
  stake_asset: '0x0000000000000000000000000000000000000000',
};

describe('indexBackendRates', () => {
  it('prices the home asset, the image token and the stake asset of a bridge', () => {
    const rates = indexBackendRates({
      bridges_info: [GBYTE_BRIDGE],
      assistants: [{ bridge_id: 2, home_token_usd_rate: 5.1, stake_token_usd_rate: 2463 }],
    });

    expect(rates).toEqual({
      [priceKey('base', 'Obyte')]: 5.1,
      [priceKey('0x31F69dE127C8A0fF10819C0955490a4Ae46fcc2a', 'Ethereum')]: 5.1, // the image is worth its home asset
      [priceKey('0x0000000000000000000000000000000000000000', 'Ethereum')]: 2463,
    });
  });

  it('skips assistants of unknown bridges and rates that are missing or zero', () => {
    const rates = indexBackendRates({
      bridges_info: [GBYTE_BRIDGE],
      assistants: [
        { bridge_id: 99, home_token_usd_rate: 1 },
        { bridge_id: 2, home_token_usd_rate: null, stake_token_usd_rate: 0 },
      ],
    });

    expect(rates).toEqual({});
  });

  it('keeps the first rate it sees for a pair', () => {
    const rates = indexBackendRates({
      bridges_info: [GBYTE_BRIDGE],
      assistants: [{ bridge_id: 2, home_token_usd_rate: 5.1 }, { bridge_id: 2, home_token_usd_rate: 5.2 }],
    });

    expect(rates[priceKey('base', 'Obyte')]).toBe(5.1);
  });

  it('copes with an empty payload', () => {
    expect(indexBackendRates()).toEqual({});
    expect(indexBackendRates({})).toEqual({});
  });
});
