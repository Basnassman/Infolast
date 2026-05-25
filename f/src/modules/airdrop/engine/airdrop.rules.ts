interface AirdropInput {
  wallet: string;
  points: number;
  totalBoughtUsd?: number;
}

interface AirdropResult {
  approved: boolean;
  tokens: number;
  reason?: string;
}

/**
 * 🧮 Calculate airdrop tokens based on points
 * Logic: 1000 points = 100 tokens (10:1 ratio)
 */
export const calculateAirdrop = (input: AirdropInput): AirdropResult => {
  const { points } = input;

  // Basic validation
  if (points <= 0) {
    return { approved: false, tokens: 0, reason: "No points earned" };
  }

  if (points > 1000000) { // Anti-abuse threshold
    return { approved: false, tokens: 0, reason: "Points exceed limit" };
  }

  // Apply 10:1 ratio
  const tokens = Math.floor(points / 10);

  return { 
    approved: true, 
    tokens 
  };
};
