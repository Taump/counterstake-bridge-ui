import { getEvmAuditAmounts } from "./getAuditAmounts";

jest.mock("services/evm", () => ({
  providers: { Ethereum: null }
}));

// the socket module opens a websocket and drags the whole store in with it
jest.mock("services/socket", () => ({ client: { request: jest.fn() } }));

const BRIDGE = {
  bridge_id: 1,
  home_network: 'Ethereum', home_asset: '0x0000000000000000000000000000000000000000',
  export_aa: '0x74aF8A878317E0F6e72e302FbcDF5f3009186398',
  foreign_network: 'Obyte', import_aa: 'UUHRSJZOQK25ICZRLPN3I2TGSDZSUM2A',
};

describe('getEvmAuditAmounts', () => {
  it('reports a network without an RPC provider as failed instead of leaving it pending', async () => {
    const updates = await getEvmAuditAmounts('Ethereum', [BRIDGE]);

    expect(updates).toEqual([
      { bridge_id: 1, field: 'locked', status: 'failed', error: 'no RPC provider configured for Ethereum' },
    ]);
  });

  it('makes no calls for a network no bridge uses', async () => {
    expect(await getEvmAuditAmounts('Polygon', [BRIDGE])).toEqual([]);
  });
});
