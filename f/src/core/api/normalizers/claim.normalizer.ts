export type NormalizeClaimInput =
  {
    id: string;

    walletAddress: string;

    amountWei: string;

    txHash: string | null;

    status: string;

    claimedAt: Date | null;

    merkleRoot?: string | null;
  };

export const normalizeClaim =
  (
    claim: NormalizeClaimInput
  ) => {
    return {
      id: claim.id,

      walletAddress:
        claim.walletAddress,

      amountWei:
        claim.amountWei,

      txHash:
        claim.txHash,

      status:
        claim.status,

      merkleRoot:
        claim.merkleRoot ??
        null,

      claimedAt:
        claim.claimedAt,
    };
  };