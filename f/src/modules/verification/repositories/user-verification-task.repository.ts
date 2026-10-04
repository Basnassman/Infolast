import { prisma } from "@core/db/prisma";
import { VerificationStatus, UserVerificationTask, VerificationPlatform } from "@prisma/client";

export interface CreateUserVerificationInput {
  userId: string;
  verificationTaskId: string;
  status?: VerificationStatus;
}

export interface UpdateUserVerificationInput {
  status?: VerificationStatus;
  verifiedAt?: Date;
  lastCheckedAt?: Date;
}

export const userVerificationTaskRepository = {
  async create(data: CreateUserVerificationInput): Promise<UserVerificationTask> {
    return prisma.userVerificationTask.create({ data });
  },

  async findById(id: string): Promise<UserVerificationTask | null> {
    return prisma.userVerificationTask.findUnique({ where: { id } });
  },

  /**
   * Ensure a PENDING verification record exists for this user/task pair.
   *
   * Called by the verification entry points (worker + task auto-verify)
   * BEFORE `verificationService.verifyUserTask()`, which fails closed when
   * the required record is missing (I.5). Never downgrades an existing
   * record: if the user already has one (e.g. VERIFIED), it is returned
   * untouched.
   */
  async ensurePending(
    userId: string,
    verificationTaskId: string
  ): Promise<UserVerificationTask> {
    const existing = await this.findByUserAndTask(userId, verificationTaskId);
    if (existing) return existing;

    try {
      return await this.create({
        userId,
        verificationTaskId,
        status: VerificationStatus.PENDING,
      });
    } catch (err: any) {
      // Unique constraint race (two concurrent requests) → read the winner.
      if (err?.code === "P2002") {
        const winner = await this.findByUserAndTask(userId, verificationTaskId);
        if (winner) return winner;
      }
      throw err;
    }
  },

  async findByUserAndTask(
    userId: string,
    verificationTaskId: string
  ): Promise<UserVerificationTask | null> {
    return prisma.userVerificationTask.findUnique({
      where: { userId_verificationTaskId: { userId, verificationTaskId } },
    });
  },

  async findByUser(userId: string): Promise<UserVerificationTask[]> {
    return prisma.userVerificationTask.findMany({
      where: { userId },
      include: { verificationTask: true },
      orderBy: { createdAt: "desc" },
    });
  },

  async findVerifiedByUser(userId: string): Promise<UserVerificationTask[]> {
    return prisma.userVerificationTask.findMany({
      where: { userId, status: VerificationStatus.VERIFIED },
      include: { verificationTask: true },
    });
  },

  async findByStatus(status: VerificationStatus): Promise<UserVerificationTask[]> {
    return prisma.userVerificationTask.findMany({
      where: { status },
      include: { verificationTask: true, user: true },
    });
  },

  async upsert(
    userId: string,
    verificationTaskId: string,
    data: Partial<CreateUserVerificationInput>
  ): Promise<UserVerificationTask> {
    return prisma.userVerificationTask.upsert({
      where: {
        userId_verificationTaskId: { userId, verificationTaskId },
      },
      create: {
        userId,
        verificationTaskId,
        status: data.status || VerificationStatus.PENDING,
      },
      update: {
        status: data.status,
      },
    });
  },

  async update(
    id: string,
    data: UpdateUserVerificationInput
  ): Promise<UserVerificationTask> {
    return prisma.userVerificationTask.update({ where: { id }, data });
  },

  async countVerifiedByUserAndPlatform(
    userId: string,
    platform: VerificationPlatform
  ): Promise<number> {
    return prisma.userVerificationTask.count({
      where: {
        userId,
        status: VerificationStatus.VERIFIED,
        verificationTask: { platform },
      },
    });
  },

  async findAllVerified(): Promise<UserVerificationTask[]> {
    return prisma.userVerificationTask.findMany({
      where: { status: VerificationStatus.VERIFIED },
      include: { verificationTask: true, user: true },
    });
  },
};
