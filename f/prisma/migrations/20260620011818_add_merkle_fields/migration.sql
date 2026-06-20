-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "blockHash" TEXT,
ADD COLUMN     "blockTimestamp" TIMESTAMP(3),
ADD COLUMN     "usdValue" DECIMAL(36,18);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SyncState_key_key" ON "SyncState"("key");

-- CreateIndex
CREATE INDEX "Purchase_blockNumber_idx" ON "Purchase"("blockNumber");

-- CreateIndex
CREATE INDEX "Purchase_createdAt_idx" ON "Purchase"("createdAt");

-- CreateIndex
CREATE INDEX "Purchase_userId_createdAt_idx" ON "Purchase"("userId", "createdAt");
