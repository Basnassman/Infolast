// src/core/api/normalizers/participant.normalizer.ts

export type NormalizeParticipantInput = {
  id?: string;
  status?: string;
  points?: number;
  allocationWei?: string;
  allocationToken?: string;
  isEligible?: boolean;
  updatedAt?: Date;
  user?: {
    id?: string;
    walletAddress?: string;
    status?: string;
  };
  // ✅ إضافة: حقول EligibilityResult
  eligible?: boolean;
  amountWei?: string;
  proof?: string[];
  claims?: any[];
};

export const normalizeParticipant = (
  participant: NormalizeParticipantInput | any
) => {
  // ✅ التحقق من نوع البيانات
  const isEligibilityResult = participant?.eligible !== undefined;
  const isParticipant = participant?.user !== undefined;
  const walletAddress = 
    participant?.walletAddress || 
    participant?.user?.walletAddress || 
    null;

  // ✅ إذا كان EligibilityResult
  if (isEligibilityResult) {
    return {
      id: null,
      walletAddress,
      userStatus: null,
      participantStatus: null,
      points: 0,
      allocationWei: participant.amountWei || "0",
      allocationToken: "0",
      isEligible: participant.eligible || false,
      updatedAt: null,
      // ✅ إضافة: حقول EligibilityResult
      eligible: participant.eligible,
      amountWei: participant.amountWei,
      proof: participant.proof || [],
      claims: participant.claims || [],
    };
  }

  // ✅ إذا كان Participant عادي
  if (isParticipant) {
    return {
      id: participant.id || null,
      walletAddress: participant.user?.walletAddress || null,
      userStatus: participant.user?.status || null,
      participantStatus: participant.status || null,
      points: participant.points || 0,
      allocationWei: participant.allocationWei || "0",
      allocationToken: participant.allocationToken || "0",
      isEligible: participant.isEligible || false,
      updatedAt: participant.updatedAt || null,
      eligible: participant.isEligible || false,
      amountWei: participant.allocationWei || "0",
      proof: [],
      claims: [],
    };
  }

  // ✅ Fallback: أي object آخر
  return {
    id: participant?.id || null,
    walletAddress: participant?.walletAddress || participant?.user?.walletAddress || null,
    userStatus: participant?.user?.status || participant?.status || null,
    participantStatus: participant?.status || null,
    points: participant?.points || 0,
    allocationWei: participant?.allocationWei || participant?.amountWei || "0",
    allocationToken: participant?.allocationToken || "0",
    isEligible: participant?.isEligible || participant?.eligible || false,
    updatedAt: participant?.updatedAt || null,
    eligible: participant?.eligible || participant?.isEligible || false,
    amountWei: participant?.amountWei || participant?.allocationWei || "0",
    proof: participant?.proof || [],
    claims: participant?.claims || [],
  };
};
