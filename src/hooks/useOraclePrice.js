import { useEffect, useState } from "react";
import { ethers } from "ethers";

import { parseOracle } from "pages/Governance/utils/viewParam";
import { getOraclePrice } from "utils/getOraclePrice";

const initialOraclePrice = {
  loading: false,
  valid: undefined,
  value: undefined
};

const getObyteOracleParams = (oracleAddress) => {
  const oracleList = Array.isArray(oracleAddress)
    ? oracleAddress
    : parseOracle(String(oracleAddress).trim());

  return oracleList.slice(0, 3).reduce((params, oracle, index) => ({
    ...params,
    [`oracle${index + 1}`]: oracle.oracle,
    [`feed_name${index + 1}`]: oracle.feed_name,
    [`op${index + 1}`]: oracle.op
  }), {});
};

export const useOraclePrice = ({
  enabled,
  network,
  homeAsset,
  homeNetwork,
  oracleAddress,
  stakeTokenAddress,
  stakeTokenSymbol
}) => {
  const [oraclePrice, setOraclePrice] = useState(initialOraclePrice);

  useEffect(() => {
    if (!enabled) {
      setOraclePrice(initialOraclePrice);
      return;
    }

    let ignore = false;

    if (!oracleAddress || (network !== "Obyte" && !homeAsset)) {
      setOraclePrice({ loading: false, valid: false, value: undefined });
      return;
    }

    setOraclePrice({ loading: true, valid: undefined, value: undefined });

    Promise.resolve()
      .then(() => network === "Obyte"
        ? getOraclePrice({
          ...getObyteOracleParams(oracleAddress),
          network,
          silent: true
        })
        : getOraclePrice({
          network,
          home_asset: homeAsset,
          home_network: homeNetwork,
          quote_asset: stakeTokenAddress === ethers.constants.AddressZero ? "_NATIVE_" : stakeTokenSymbol,
          oracle: oracleAddress,
          silent: true
        }))
      .then(([valid, price]) => {
        if (!ignore) {
          setOraclePrice({
            loading: false,
            valid,
            value: price
          });
        }
      })
      .catch(() => {
        if (!ignore) {
          setOraclePrice({ loading: false, valid: false, value: undefined });
        }
      });

    return () => {
      ignore = true;
    };
  }, [enabled, network, homeAsset, homeNetwork, oracleAddress, stakeTokenAddress, stakeTokenSymbol]);

  return oraclePrice;
};
