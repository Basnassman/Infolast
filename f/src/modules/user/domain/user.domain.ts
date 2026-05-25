export type UserDomain = {
  wallet: string;
  totalBought: number;
  airdropPoints: number;
  tokensAllocated: string;     // بالـ FOR (للعرض)
  tokensAllocatedWei: string;  // ← بالـ wei (للعقد)
  tokensBought: string;        // بالـ FOR
  tokensBoughtWei: string;     // ← بالـ wei   // بالـ FOR
  category: string;            // AIRDROP_ONLY, AIRDROP_BUYER, BUYER_ONLY, NONE
  tier: string;               // BRONZE, SILVER, GOLD, PLATINUM
  hasClaimedAirdrop: boolean;
  hasClaimedTokens: boolean;
};

export type UserMerkleData = {
  wallet: string;

  merkleProof: string[];

  chainId: number;

  merkleLeaf: string | null;

  merkleRoot: string;
};

export type UserVestingView = {
  vestedTokens: string;

  claimableTokens: string;
};

/**
 * ✅ Check if user is eligible for airdrop
 */
export const isEligibleForAirdrop = (user: UserDomain): boolean => {
  return (
    user.airdropPoints > 0 &&
    BigInt(user.tokensAllocatedWei || "0") > 0n &&
    !user.category?.includes("BLOCKED")
  );
};

/**
 * 🧮 Calculate user power score
 */
export const calculateUserPower = (user: UserDomain): number => {
  return user.totalBought + user.airdropPoints;
};

/**
 * 💰 Calculate total tokens (allocated + bought)
 */
export const calculateTotalTokens = (user: UserDomain): string => {
  const allocated = BigInt(user.tokensAllocatedWei || "0");
  const bought = BigInt(user.tokensBoughtWei || "0");
  return (allocated + bought).toString();
};

/**
 * 📊 Get user summary
 */
export const getUserSummary = (
  user: UserDomain,
  vesting: UserVestingView,
  merkle: UserMerkleData
) => {
  const totalTokens =
    calculateTotalTokens(user);

  const power =
    calculateUserPower(user);

  return {
    wallet: user.wallet,

    category: user.category,

    tier: user.tier,

    power,

    totalTokens,
    airdrop: {
      points: user.airdropPoints,
      tokens: user.tokensAllocated,
      tokensWei: user.tokensAllocatedWei,
      merkleProof: merkle.merkleProof,
      merkleLeaf: merkle.merkleLeaf,
      claimed: user.hasClaimedAirdrop,
    },
    purchase: {
      totalBought: user.totalBought,
      tokens: user.tokensBought,
      tokensWei: user.tokensBoughtWei,
    },
    vesting: {
      vested: vesting.vestedTokens,
      claimable:vesting.claimableTokens,
    },
    chainId: merkle.chainId,
  };
};