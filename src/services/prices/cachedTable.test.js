import { cachedTable } from "./cachedTable";

const TTL = 5 * 60 * 1000;

describe('cachedTable', () => {
  afterEach(() => jest.restoreAllMocks());

  it('loads once and serves the same table until it expires', async () => {
    const load = jest.fn().mockResolvedValue({ a: 1 });
    const table = cachedTable(load, TTL);

    expect(await table.get()).toEqual({ a: 1 });
    expect(await table.get()).toEqual({ a: 1 });
    expect(load).toHaveBeenCalledTimes(1);

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + TTL + 1);
    await table.get();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('shares one request between callers that arrive while it is in flight', async () => {
    let resolve;
    const load = jest.fn(() => new Promise(r => { resolve = r; }));
    const table = cachedTable(load, TTL);

    const first = table.get();
    const second = table.get();
    expect(load).toHaveBeenCalledTimes(1);

    resolve({ a: 1 });
    expect(await first).toBe(await second);
  });

  it('forgets a failed load so the next caller retries', async () => {
    const load = jest.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue({ a: 1 });
    const table = cachedTable(load, TTL);

    await expect(table.get()).rejects.toThrow('down');
    expect(await table.get()).toEqual({ a: 1 });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('reloads after clear()', async () => {
    const load = jest.fn().mockResolvedValue({ a: 1 });
    const table = cachedTable(load, TTL);

    await table.get();
    table.clear();
    await table.get();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
