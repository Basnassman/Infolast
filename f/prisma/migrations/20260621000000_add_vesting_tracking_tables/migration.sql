-- =====================================================
-- Migration: Replace old VestingSchedule schema with new tracking schema
-- Original table was created in 20260604222534_add_merkle_fields
-- =====================================================

-- Step 1: Drop dependent foreign keys from VestingRelease and DistributionClaim
ALTER TABLE "VestingRelease" DROP CONSTRAINT IF EXISTS "VestingRelease_vestingScheduleId_fkey";
ALTER TABLE "DistributionClaim" DROP CONSTRAINT IF EXISTS "DistributionClaim_vestingScheduleId_fkey";

-- Step 2: Drop the old VestingRelease table (replaced by VestingClaimEvent)
DROP TABLE IF EXISTS "VestingRelease";

-- Step 3: Remove old columns from VestingSchedule
ALTER TABLE "VestingSchedule" DROP COLUMN IF EXISTS "totalAmountWei";
ALTER TABLE "VestingSchedule" DROP COLUMN IF EXISTS "releasedAmountWei";
ALTER TABLE "VestingSchedule" DROP COLUMN IF EXISTS "startTime";
ALTER TABLE "VestingSchedule" DROP COLUMN IF EXISTS "cliffTime";
ALTER TABLE "VestingSchedule" DROP COLUMN IF EXISTS "endTime";
ALTER TABLE "VestingSchedule" DROP COLUMN IF EXISTS "revoked";
ALTER TABLE "VestingSchedule" DROP COLUMN IF EXISTS "revokable";
ALTER TABLE "VestingSchedule" DROP COLUMN IF EXISTS "vestingDirty";

-- Step 4: Add new tracking columns to VestingSchedule
ALTER TABLE "VestingSchedule" ADD COLUMN "totalAllocatedWei" TEXT NOT NULL DEFAULT '0';
ALTER TABLE "VestingSchedule" ADD COLUMN "totalClaimedWei" TEXT NOT NULL DEFAULT '0';
ALTER TABLE "VestingSchedule" ADD COLUMN "lastClaimedAt" TIMESTAMP(3);
ALTER TABLE "VestingSchedule" ADD COLUMN "claimCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VestingSchedule" ADD COLUMN "lastClaimTxHash" TEXT;

-- Step 5: Drop old VestingSchedule indexes and create new ones
DROP INDEX IF EXISTS "VestingSchedule_vestingDirty_idx";
CREATE INDEX "VestingSchedule_userId_idx" ON "VestingSchedule"("userId");
CREATE INDEX "VestingSchedule_source_userId_idx" ON "VestingSchedule"("source", "userId");

-- Step 6: Create the new VestingClaimEvent table
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

-- Step 7: Create indexes on VestingClaimEvent
CREATE UNIQUE INDEX "VestingClaimEvent_txHash_key" ON "VestingClaimEvent"("txHash");
CREATE INDEX "VestingClaimEvent_vestingScheduleId_idx" ON "VestingClaimEvent"("vestingScheduleId");
CREATE INDEX "VestingClaimEvent_blockTimestamp_idx" ON "VestingClaimEvent"("blockTimestamp");

-- Step 8: Re-add foreign keys
ALTER TABLE "VestingSchedule" ADD CONSTRAINT "VestingSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VestingClaimEvent" ADD CONSTRAINT "VestingClaimEvent_vestingScheduleId_fkey" FOREIGN KEY ("vestingScheduleId") REFERENCES "VestingSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributionClaim" ADD CONSTRAINT "DistributionClaim_vestingScheduleId_fkey" FOREIGN KEY ("vestingScheduleId") REFERENCES "VestingSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
