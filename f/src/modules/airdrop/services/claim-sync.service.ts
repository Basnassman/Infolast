import { provider } from "@core/blockchain/provider";
import { markClaimClaimed, markClaimFailed } from "@modules/airdrop/repositories/claim.repository";

export const syncClaimTransaction = async (claimId: string, txHash: string) => {
  try {
    const receipt = await provider.waitForTransaction(txHash);

    if (!receipt || receipt.status !== 1) {
      // ✅ إصلاح: إزالة reason - الدالة لا تأخذ reason
      await markClaimFailed(claimId);
      return { success: false };
    }

    // ✅ إصلاح: markClaimClaimed بدلاً من markClaimCompleted
    await markClaimClaimed(claimId, txHash);

    return { success: true };
  } catch (error: any) {
    // ✅ إصلاح: إزالة reason
    await markClaimFailed(claimId);
    return {
      success: false,
      error: error.message,
    };
  }
};
