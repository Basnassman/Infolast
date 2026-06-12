import { ethers } from "ethers";
import { env } from "@core/config/env";
import { contracts, DEFAULT_CHAIN } from "@core/config/contracts";

const chain = DEFAULT_CHAIN;
const config = contracts[chain];

export const provider = new ethers.JsonRpcProvider(config.rpc);
export const wallet = env.privateKey
  ? new ethers.Wallet(env.privateKey, provider)
  : null;

export { chain, config };