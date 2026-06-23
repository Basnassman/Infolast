-- =====================================================
-- FIX VESTING MIGRATION
-- =====================================================
-- Run this script to fix the migration state and ensure
-- all indexes and constraints exist on the vesting tables.
--
-- Usage:
--   psql $DATABASE_URL -f scripts/fix-vesting-migration.sql
--
-- Then mark the migration as applied:
--   npx prisma migrate resolve --applied 20260621000000_add_vesting_tracking_tables

-- Step 0: Create User rows for any orphaned schedules (userId is a wallet
-- address with no matching User record). FK constraint requires every
-- VestingSchedule.userId to reference an existing User.id.
INSERT INTO "User" ("id", "walletAddress", "status", "createdAt", "updatedAt")
SELECT vs."userId", vs."userId", 'ACTIVE', NOW(), NOW()
FROM "VestingSchedule" vs
LEFT JOIN "User" u ON u."walletAddress" = vs."userId"
WHERE u."id" IS NULL
  AND vs."userId" LIKE '0x%'
ON CONFLICT ("walletAddress") DO NOTHING;

-- Step 1: Create tables if they don't exist (safe to run multiple times)
CREATE TABLE IF NOT EXISTS "VestingSchedule" (
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

CREATE TABLE IF NOT EXISTS "VestingClaimEvent" (
    "id" TEXT NOT NULL,
    "vestingScheduleId" TEXT NOT NULL,
    "amountWei" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "blockNumber" BIGINT,
    "blockTimestamp" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VestingClaimEvent_pkey" PRIMARY KEY ("id")
);

-- Step 2: Fix existing data — update VestingSchedule.userId to use User.id (cuid)
-- instead of wallet addresses. MUST run BEFORE adding FK constraint.
UPDATE "VestingSchedule" vs
SET "userId" = u."id"
FROM "User" u
WHERE vs."userId" = u."walletAddress"
  AND vs."userId" != u."id";

-- Step 3: Add indexes (safe to run multiple times with IF NOT EXISTS)
CREATE UNIQUE INDEX IF NOT EXISTS "VestingClaimEvent_txHash_key" ON "VestingClaimEvent"("txHash");
CREATE INDEX IF NOT EXISTS "VestingSchedule_source_idx" ON "VestingSchedule"("source");
CREATE INDEX IF NOT EXISTS "VestingSchedule_userId_idx" ON "VestingSchedule"("userId");
CREATE INDEX IF NOT EXISTS "VestingSchedule_source_userId_idx" ON "VestingSchedule"("source", "userId");
CREATE INDEX IF NOT EXISTS "VestingClaimEvent_vestingScheduleId_idx" ON "VestingClaimEvent"("vestingScheduleId");
CREATE INDEX IF NOT EXISTS "VestingClaimEvent_blockTimestamp_idx" ON "VestingClaimEvent"("blockTimestamp");

-- Step 4: Add foreign key constraints (safe to run multiple times)
-- Data is already fixed in Step 2, so FK constraint will not fail.
DO $$ BEGIN
    ALTER TABLE "VestingSchedule" ADD CONSTRAINT "VestingSchedule_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "VestingClaimEvent" ADD CONSTRAINT "VestingClaimEvent_vestingScheduleId_fkey"
        FOREIGN KEY ("vestingScheduleId") REFERENCES "VestingSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
