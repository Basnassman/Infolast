export type NormalizeParticipantInput =
  {
    id: string;

    status: string;

    points: number;

    allocationWei: string;

    allocationToken: string;

    isEligible: boolean;

    updatedAt: Date;

    user: {
      id: string;

      walletAddress: string;

      status: string;
    };
  };

export const normalizeParticipant =
  (
    participant: NormalizeParticipantInput
  ) => {
    return {
      id: participant.id,

      walletAddress:
        participant.user
          .walletAddress,

      userStatus:
        participant.user
          .status,

      participantStatus:
        participant.status,

      points:
        participant.points,

      allocationWei:
        participant.allocationWei,

      allocationToken:
        participant.allocationToken,

      isEligible:
        participant.isEligible,

      updatedAt:
        participant.updatedAt,
    };
  };