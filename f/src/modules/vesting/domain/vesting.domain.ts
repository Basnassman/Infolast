export type VestingInput = {
  total: string;        // BigInt as string
  claimed: string;      // BigInt as string
  startTime: number;    // Unix timestamp
  now: number;          // Current Unix timestamp
  cliff: number;        // Seconds (from contract: 4 days = 345600)
  month: number;        // Seconds (from contract: 1 day = 86400)
  totalStages: number;   // From contract: 4
  stageShare: number;    // From contract: 25 (%)
};

/**
 * 🧮 Calculate unlocked tokens based on contract logic
 * Matches Airdrop.sol: _releasable() function
 */
export const calculateUnlocked = (v: VestingInput): string => {
  const total = BigInt(v.total);
  const claimed = BigInt(v.claimed);

  // Before cliff: nothing
  if (v.now < v.startTime + v.cliff) {
    return "0";
  }

  // Calculate stages passed
  const elapsed = v.now - (v.startTime + v.cliff);
  let stages = Math.floor(elapsed / v.month) + 1;
  
  // Cap at total stages
  if (stages > v.totalStages) {
    stages = v.totalStages;
  }

  // Calculate vested amount
  const vested = (total * BigInt(stages) * BigInt(v.stageShare)) / 100n;

  // Return releasable (vested - claimed)
  if (vested <= claimed) {
    return "0";
  }

  return (vested - claimed).toString();
};

/**
 * 📊 Calculate total vested (not just releasable)
 */
export const calculateVested = (v: VestingInput): string => {
  const total = BigInt(v.total);

  if (v.now < v.startTime + v.cliff) {
    return "0";
  }

  const elapsed = v.now - (v.startTime + v.cliff);
  let stages = Math.floor(elapsed / v.month) + 1;
  
  if (stages > v.totalStages) {
    stages = v.totalStages;
  }

  const vested = (total * BigInt(stages) * BigInt(v.stageShare)) / 100n;
  return vested.toString();
};

/**
 * ✅ Check if fully unlocked
 */
export const isFullyUnlocked = (v: VestingInput): boolean => {
  const totalDuration = v.cliff + (v.month * (v.totalStages - 1));
  return v.now >= v.startTime + totalDuration;
};

/**
 * 📈 Get vesting progress percentage
 */
export const getVestingProgress = (v: VestingInput): number => {
  const total = BigInt(v.total);
  if (total === 0n) return 0;

  const vested = BigInt(calculateVested(v));
  return Number((vested * 100n) / total);
};

/**
 * ⏰ Get next unlock date
 */
export const getNextUnlock = (v: VestingInput): number => {
  if (isFullyUnlocked(v)) return 0;

  const cliffEnd = v.startTime + v.cliff;
  
  if (v.now < cliffEnd) {
    return cliffEnd;
  }

  const elapsed = v.now - cliffEnd;
  const stagesPassed = Math.floor(elapsed / v.month);
  const nextStage = stagesPassed + 1;

  if (nextStage >= v.totalStages) {
    return v.startTime + v.cliff + (v.month * (v.totalStages - 1));
  }

  return cliffEnd + (v.month * nextStage);
};