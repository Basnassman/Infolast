import { prisma } from "../db/prisma";
import { getUserVesting, getVestingConstants } from "../blockchain/vesting.contract";
import { calculateUnlocked, calculateVested, getVestingProgress, getNextUnlock } from "../domain/vesting.domain";

const DECIMALS = 18;

/**
 * تحويل FOR إلى wei
 */
const toWei = (tokens: string | number): string => {
  return (BigInt(Math.floor(Number(tokens) * 10 ** DECIMALS))).toString();
};

/**
 * 🔓 Record vesting claim
 * 
 * يستقبل من Frontend بعد سحب التوكنز من العقد:
 * {
 *   wallet: "0x...",
 *   txHash: "0x...",
 *   amount: "25000000000000000000"  // wei
 * }
 */
export const recordVestingClaim = async (
  wallet: string,
  txHash: string,
  amountWei: string
) => {
  const normalizedWallet = wallet.toLowerCase();

  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { wallet: normalizedWallet }
    });

    if (!user) throw new Error("User not found");

    // تحويل wei إلى FOR
    const amountFor = (BigInt(amountWei) / BigInt(10 ** DECIMALS)).toString();

    // إنشاء سجل السحب
    const claim = await tx.vestingClaim.create({
      data: {
        userId: normalizedWallet,
        txHash,
        amountWei,
        amountFor,
      }
    });

    // تحديث حالة المستخدم
    await tx.user.update({
      where: { wallet: normalizedWallet },
      data: {
        hasClaimedTokens: true,
        tokensClaimedAt: new Date(),
        tokensClaimTxHash: txHash,
      }
    });

    // Audit Log
    await tx.auditLog.create({
      data: {
        action: "VESTING_CLAIM",
        userId: normalizedWallet,
        txHash,
        metadata: { amountWei, amountFor }
      }
    });

    return claim;
  });
};

/**
 * 📊 Get user vesting status (from blockchain + database)
 */
export const getUserVestingStatus = async (wallet: string) => {
  const normalizedWallet = wallet.toLowerCase();

  // جلب من العقد
  const [vestingData, constants] = await Promise.all([
    getUserVesting(normalizedWallet),
    getVestingConstants(),
  ]);

  const now = Math.floor(Date.now() / 1000);

  // حساب المستحقات
  const vestingInput = {
    total: vestingData.total,
    claimed: vestingData.claimed,
    startTime: 0, // يجب جلبه من العقد
    now,
    cliff: constants.cliff,
    month: constants.month,
    totalStages: constants.totalStages,
    stageShare: constants.stageShare,
  };

  const releasable = calculateUnlocked(vestingInput);
  const vested = calculateVested(vestingInput);
  const progress = getVestingProgress(vestingInput);
  const nextUnlock = getNextUnlock(vestingInput);

  // جلب من قاعدة البيانات
  const user = await prisma.user.findUnique({
    where: { wallet: normalizedWallet },
    include: {
      vestingClaims: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  return {
    wallet: normalizedWallet,
    total: vestingData.total,
    claimed: vestingData.claimed,
    remaining: vestingData.remaining,
    releasable,
    vested,
    progress,
    nextUnlock,
    hasClaimedTokens: user?.hasClaimedTokens || false,
    claims: user?.vestingClaims || [],
  };
};

/**
 * 📜 Get user vesting claims history
 */
export const getUserVestingClaims = async (wallet: string) => {
  const normalizedWallet = wallet.toLowerCase();

  const claims = await prisma.vestingClaim.findMany({
    where: { userId: normalizedWallet },
    orderBy: { createdAt: "desc" }
  });

  return claims;
};