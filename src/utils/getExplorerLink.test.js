import { getExplorerLink } from "./getExplorerLink";

const KAVA_TOKEN = '0x0b93109d05Ef330acD2c75148891cc61D20C3EF1';
const OBYTE_AA = 'H2SVLDNYWYI3ISCQYH5VSTOTQBJ7PZSU';

describe('getExplorerLink', () => {
  it('sends Kava to kavascan, which is the one that still answers', () => {
    expect(getExplorerLink('Kava', KAVA_TOKEN, 'address')).toBe(`https://kavascan.com/address/${KAVA_TOKEN}`);
    expect(getExplorerLink('Kava', KAVA_TOKEN, 'token')).toBe(`https://kavascan.com/token/${KAVA_TOKEN}`);
    expect(getExplorerLink('Kava', '0xdeadbeef')).toBe('https://kavascan.com/tx/0xdeadbeef');
  });

  it('keeps the other explorers as they were', () => {
    expect(getExplorerLink('Ethereum', KAVA_TOKEN, 'token')).toBe(`https://etherscan.io/token/${KAVA_TOKEN}`);
    expect(getExplorerLink('BSC', KAVA_TOKEN, 'address')).toBe(`https://bscscan.com/address/${KAVA_TOKEN}`);
    expect(getExplorerLink('Obyte', OBYTE_AA, 'address')).toBe(`https://explorer.obyte.org/address/${OBYTE_AA}`);
  });
});
