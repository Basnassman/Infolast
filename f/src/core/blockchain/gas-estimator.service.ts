import { ethers } from "ethers";

export const estimateGasBuffer =
  (
    gas:
      | bigint
      | number
  ): bigint => {
    const value =
      BigInt(gas);

    return (
      value +
      value / BigInt(5)
    );
  };

export const formatGas =
  (
    gas: bigint
  ): string => {
    return ethers.formatUnits(
      gas,
      "gwei"
    );
  };