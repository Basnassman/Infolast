-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "DistributionType" AS ENUM ('AIRDROP', 'VESTING', 'PURCHASE', 'STAKING', 'REFERRAL');

-- CreateEnum
CREATE TYPE "MerkleJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'CLAIMED', 'FAILED');

-- CreateEnum
CREATE TYPE "PurchaseSource" AS ENUM ('PUBLIC', 'PRIVATE', 'OTC');

-- CreateEnum
CREATE TYPE "PaymentAsset" AS ENUM ('ETH', 'USDT', 'USDC', 'BNB', 'MATIC');

-- CreateEnum
CREATE TYPE "VestingSource" AS ENUM ('AIRDROP', 'PRESALE', 'TEAM', 'ADVISOR', 'INVESTOR');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'REVIEW');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('SOCIAL', 'VIDEO', 'ARTICLE', 'REFERRAL');

-- CreateEnum
CREATE TYPE "TaskPlatform" AS ENUM ('X', 'TELEGRAM', 'YOUTUBE', 'DISCORD', 'ARTICLE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRiskProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "isSybilSuspected" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRiskProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AirdropParticipant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "allocationWei" TEXT NOT NULL DEFAULT '0',
    "isEligible" BOOLEAN NOT NULL DEFAULT true,
    "airdropDirty" BOOLEAN NOT NULL DEFAULT false,
    "lastCalculatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AirdropParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerkleRoot" (
    "id" TEXT NOT NULL,
    "distributionType" "DistributionType" NOT NULL,
    "root" TEXT NOT NULL,
    "ipfsSnapshotUrl" TEXT,
    "eligibleCount" INTEGER NOT NULL,
    "totalAmountWei" TEXT NOT NULL,
    "txHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerkleRoot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerkleProof" (
    "id" TEXT NOT NULL,
    "merkleRootId" TEXT NOT NULL,
    "airdropParticipantId" TEXT,
    "walletAddress" TEXT NOT NULL,
    "proof" JSONB NOT NULL,
    "leaf" TEXT NOT NULL,
    "amountWei" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerkleProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerkleJob" (
    "id" TEXT NOT NULL,
    "distributionType" "DistributionType" NOT NULL,
    "status" "MerkleJobStatus" NOT NULL,
    "merkleRootId" TEXT,
    "txHash" TEXT,
    "eligibleCount" INTEGER,
    "totalAmountWei" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerkleJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "points" INTEGER NOT NULL,
    "platform" "TaskPlatform" NOT NULL,
    "type" "TaskType" NOT NULL DEFAULT 'SOCIAL',
    "url" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxSubmissions" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "rewardGiven" BOOLEAN NOT NULL DEFAULT false,
    "points" INTEGER NOT NULL DEFAULT 0,
    "ip" TEXT,
    "userAgent" TEXT,
    "proof" JSONB,
    "completedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributionClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "distributionType" "DistributionType" NOT NULL,
    "airdropParticipantId" TEXT,
    "vestingScheduleId" TEXT,
    "amountWei" TEXT NOT NULL,
    "txHash" TEXT,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DistributionClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VestingSchedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "VestingSource" NOT NULL,
    "totalAllocatedWei" TEXT NOT NULL,
    "totalClaimedWei" TEXT NOT NULL DEFAULT '0',
    "lastClaimedAt" TIMESTAMP(3),
    "claimCount" INTEGER NOT NULL DEFAULT 0,
    "lastClaimTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VestingSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VestingClaimEvent" (
    "id" TEXT NOT NULL,
    "vestingScheduleId" TEXT NOT NULL,
    "amountWei" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "blockNumber" BIGINT,
    "blockTimestamp" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VestingClaimEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "PurchaseSource" NOT NULL,
    "paymentAsset" "PaymentAsset" NOT NULL,
    "paymentAmount" DECIMAL(36,18) NOT NULL,
    "paymentAmountWei" TEXT NOT NULL,
    "tokenReceived" DECIMAL(36,18) NOT NULL,
    "tokenReceivedWei" TEXT NOT NULL,
    "tokenPriceUsd" DECIMAL(36,18),
    "usdValue" DECIMAL(36,18),
    "chainId" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "blockNumber" BIGINT,
    "blockTimestamp" TIMESTAMP(3),
    "blockHash" TEXT,
    "purchaseDirty" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributionSnapshot" (
    "id" TEXT NOT NULL,
    "distributionType" "DistributionType" NOT NULL,
    "snapshotVersion" INTEGER NOT NULL,
    "totalUsers" INTEGER NOT NULL,
    "totalAmountWei" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DistributionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueueEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE INDEX "UserTag_tag_idx" ON "UserTag"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "UserTag_userId_tag_key" ON "UserTag"("userId", "tag");

-- CreateIndex
CREATE UNIQUE INDEX "UserRiskProfile_userId_key" ON "UserRiskProfile"("userId");

-- CreateIndex
CREATE INDEX "UserAuditLog_userId_idx" ON "UserAuditLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AirdropParticipant_userId_key" ON "AirdropParticipant"("userId");

-- CreateIndex
CREATE INDEX "AirdropParticipant_airdropDirty_idx" ON "AirdropParticipant"("airdropDirty");

-- CreateIndex
CREATE INDEX "AirdropParticipant_isEligible_idx" ON "AirdropParticipant"("isEligible");

-- CreateIndex
CREATE UNIQUE INDEX "MerkleRoot_root_key" ON "MerkleRoot"("root");

-- CreateIndex
CREATE INDEX "MerkleRoot_distributionType_idx" ON "MerkleRoot"("distributionType");

-- CreateIndex
CREATE INDEX "MerkleRoot_createdAt_idx" ON "MerkleRoot"("createdAt");

-- CreateIndex
CREATE INDEX "MerkleProof_walletAddress_idx" ON "MerkleProof"("walletAddress");

-- CreateIndex
CREATE INDEX "MerkleProof_merkleRootId_idx" ON "MerkleProof"("merkleRootId");

-- CreateIndex
CREATE INDEX "MerkleJob_status_idx" ON "MerkleJob"("status");

-- CreateIndex
CREATE INDEX "MerkleJob_distributionType_idx" ON "MerkleJob"("distributionType");

-- CreateIndex
CREATE INDEX "UserTask_userId_idx" ON "UserTask"("userId");

-- CreateIndex
CREATE INDEX "UserTask_taskId_idx" ON "UserTask"("taskId");

-- CreateIndex
CREATE INDEX "UserTask_status_idx" ON "UserTask"("status");

-- CreateIndex
CREATE UNIQUE INDEX "UserTask_userId_taskId_key" ON "UserTask"("userId", "taskId");

-- CreateIndex
CREATE INDEX "DistributionClaim_userId_idx" ON "DistributionClaim"("userId");

-- CreateIndex
CREATE INDEX "DistributionClaim_distributionType_idx" ON "DistributionClaim"("distributionType");

-- CreateIndex
CREATE INDEX "VestingSchedule_source_idx" ON "VestingSchedule"("source");

-- CreateIndex
CREATE INDEX "VestingSchedule_userId_idx" ON "VestingSchedule"("userId");

-- CreateIndex
CREATE INDEX "VestingSchedule_source_userId_idx" ON "VestingSchedule"("source", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "VestingClaimEvent_txHash_key" ON "VestingClaimEvent"("txHash");

-- CreateIndex
CREATE INDEX "VestingClaimEvent_vestingScheduleId_idx" ON "VestingClaimEvent"("vestingScheduleId");

-- CreateIndex
CREATE INDEX "VestingClaimEvent_txHash_idx" ON "VestingClaimEvent"("txHash");

-- CreateIndex
CREATE INDEX "VestingClaimEvent_blockTimestamp_idx" ON "VestingClaimEvent"("blockTimestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_txHash_key" ON "Purchase"("txHash");

-- CreateIndex
CREATE INDEX "Purchase_userId_idx" ON "Purchase"("userId");

-- CreateIndex
CREATE INDEX "Purchase_paymentAsset_idx" ON "Purchase"("paymentAsset");

-- CreateIndex
CREATE INDEX "Purchase_source_idx" ON "Purchase"("source");

-- CreateIndex
CREATE INDEX "Purchase_blockNumber_idx" ON "Purchase"("blockNumber");

-- CreateIndex
CREATE INDEX "Purchase_createdAt_idx" ON "Purchase"("createdAt");

-- CreateIndex
CREATE INDEX "Purchase_userId_createdAt_idx" ON "Purchase"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DistributionSnapshot_distributionType_snapshotVersion_key" ON "DistributionSnapshot"("distributionType", "snapshotVersion");

-- CreateIndex
CREATE UNIQUE INDEX "SyncState_key_key" ON "SyncState"("key");

-- CreateIndex
CREATE INDEX "QueueEvent_processed_idx" ON "QueueEvent"("processed");

-- CreateIndex
CREATE INDEX "QueueEvent_type_idx" ON "QueueEvent"("type");

-- AddForeignKey
ALTER TABLE "UserTag" ADD CONSTRAINT "UserTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRiskProfile" ADD CONSTRAINT "UserRiskProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAuditLog" ADD CONSTRAINT "UserAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AirdropParticipant" ADD CONSTRAINT "AirdropParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerkleProof" ADD CONSTRAINT "MerkleProof_merkleRootId_fkey" FOREIGN KEY ("merkleRootId") REFERENCES "MerkleRoot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerkleProof" ADD CONSTRAINT "MerkleProof_airdropParticipantId_fkey" FOREIGN KEY ("airdropParticipantId") REFERENCES "AirdropParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerkleJob" ADD CONSTRAINT "MerkleJob_merkleRootId_fkey" FOREIGN KEY ("merkleRootId") REFERENCES "MerkleRoot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTask" ADD CONSTRAINT "UserTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTask" ADD CONSTRAINT "UserTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionClaim" ADD CONSTRAINT "DistributionClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionClaim" ADD CONSTRAINT "DistributionClaim_airdropParticipantId_fkey" FOREIGN KEY ("airdropParticipantId") REFERENCES "AirdropParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionClaim" ADD CONSTRAINT "DistributionClaim_vestingScheduleId_fkey" FOREIGN KEY ("vestingScheduleId") REFERENCES "VestingSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VestingSchedule" ADD CONSTRAINT "VestingSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VestingClaimEvent" ADD CONSTRAINT "VestingClaimEvent_vestingScheduleId_fkey" FOREIGN KEY ("vestingScheduleId") REFERENCES "VestingSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
