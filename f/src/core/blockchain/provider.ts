import { ethers } from "ethers";
import { contracts, DEFAULT_CHAIN } from "@core/config/contracts";

const chain = DEFAULT_CHAIN;
const config = contracts[chain];

// Provider for read operations
export const provider = new ethers.JsonRpcProvider(config.rpc);

// Signer for write operations (admin wallet)
const privateKey = process.env.PRIVATE_KEY;
export const wallet = privateKey 
  ? new ethers.Wallet(privateKey, provider)
  : null;

export { chain, config };