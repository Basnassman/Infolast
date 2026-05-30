export interface ClaimStatusResult {
  eligible: boolean;
  amountWei: string;
  points: number;
  proof: string[];
  claims: any[];
}

export interface AirdropStatsResult {
  totalUsers: number;
  participants: number;
  claims: number;
  activeRoot: string | null;
  eligibleCount: number;
  totalAmountWei: string;
  totalPoints: number;
}

export interface EligibilityResponse {
  walletAddress: string;
  eligible: boolean;
  amountWei: string;
  points: number;
  proof: string[];
  claims: any[];
}