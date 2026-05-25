export const airdropConfig = {
  // Sepolia configuration
  chainId: 11155111,
  
  // Token allocation rules
  baseRate: 10, // 10 points = 1 token
  maxPointsPerUser: 10000,
  
  multipliers: {
    hasBought: 1.2,
    default: 1,
  },
  
  rules: {
    minPoints: 1,
    antiAbuseMax: 10000,
  },
  
  // Merkle tree settings
  merkle: {
    sortPairs: true,
  },
} as const;