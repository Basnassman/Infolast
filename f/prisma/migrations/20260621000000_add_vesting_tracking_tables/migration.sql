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

-- CreateIndex
CREATE UNIQUE INDEX "VestingClaimEvent_txHash_key" ON "VestingClaimEvent"("txHash");

-- CreateIndex
CREATE INDEX "VestingSchedule_source_idx" ON "VestingSchedule"("source");

-- CreateIndex
CREATE INDEX "VestingSchedule_userId_idx" ON "VestingSchedule"("userId");

-- CreateIndex
CREATE INDEX "VestingSchedule_source_userId_idx" ON "VestingSchedule"("source", "userId");

-- CreateIndex
CREATE INDEX "VestingClaimEvent_vestingScheduleId_idx" ON "VestingClaimEvent"("vestingScheduleId");

-- CreateIndex
CREATE INDEX "VestingClaimEvent_blockTimestamp_idx" ON "VestingClaimEvent"("blockTimestamp");

-- AddForeignKey
ALTER TABLE "VestingSchedule" ADD CONSTRAINT "VestingSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VestingClaimEvent" ADD CONSTRAINT "VestingClaimEvent_vestingScheduleId_fkey" FOREIGN KEY ("vestingScheduleId") REFERENCES "VestingSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
