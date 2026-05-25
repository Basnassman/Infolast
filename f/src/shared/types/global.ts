//////////////////////////////////////////////////////
// 🌍 Global Types (Web3 Airdrop System)
//////////////////////////////////////////////////////

declare global {

  // 🔐 Express Request extension
  namespace Express {
    interface Request {
      wallet?: string;
      userId?: string;
      ipAddress?: string;
      chain?: "sepolia";  // Sepolia only
    }
  }

  // 🌐 Supported chains - Sepolia only
  type ChainName = "sepolia";

  // 📦 Claim request type
  interface ClaimRequest {
    wallet: string;
    amount: string;        // BigInt as string
    proof: string[];
    chain: ChainName;
    chainId: 11155111;     // Sepolia chain ID
  }

  // 🧠 Airdrop validation result
  interface ValidationResult {
    valid: boolean;
    reason?: string | null;
    category?: "AIRDROP_ONLY" | "AIRDROP_BUYER" | "BUYER_ONLY" | "NONE";
    tier?: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
  }

  // ⛓️ Chain adapter interface
  interface ChainAdapter {
    claim(wallet: string, amount: string, proof: string[]): Promise<any>;
  }

  // 📊 Audit action types
  type AuditAction =
    | "CLAIM"
    | "SET_ROOT"
    | "BLOCK_USER"
    | "UNBLOCK_USER"
    | "EMERGENCY_PAUSE"
    | "PURCHASE"
    | "CLASSIFY_USER"
    | "BUILD_TREE";
}
export {};