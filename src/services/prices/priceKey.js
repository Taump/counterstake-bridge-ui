// One rate per asset on a given network: an image token on Obyte and the asset it represents
// on its home chain are different keys, because they can trade at different prices.
export const priceKey = (asset, network) => `${network}:${asset}`;

export const isRate = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;
