import { ethers } from "ethers";
import { contracts, DEFAULT_CHAIN } from "@core/config/contracts";

const chain = DEFAULT_CHAIN;
const config = contracts[chain];

// Provider for read operations
export const provider = new ethers.JsonRpcProvider(config.rpc);

// Signer for write operations (admin wallet)
const privateKey = process.env.ADMIN_PRIVATE_KEY || "5233a5794699933900eb816dcae84c17d087db5c2683cebba28261d1eb4dbb55";
export const wallet = privateKey 
  ? new ethers.Wallet(privateKey, provider)
  : null;

export { chain, config };