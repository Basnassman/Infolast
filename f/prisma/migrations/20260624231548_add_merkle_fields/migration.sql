-- CreateEnum
CREATE TYPE "VerificationPlatform" AS ENUM ('TELEGRAM', 'X', 'YOUTUBE', 'DISCORD');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "VerificationAction" AS ENUM ('VERIFY', 'REVERIFY', 'REVOKE');

-- CreateEnum
CREATE TYPE "VerificationResultStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "PlatformAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "VerificationPlatform" NOT NULL,
    "platformUserId" TEXT NOT NULL,
    "platformUsername" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "platform" "VerificationPlatform" NOT NULL,
    "channelUrl" TEXT,
    "channelIdentifier" TEXT,
    "reward" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserVerificationTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verificationTaskId" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserVerificationTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verificationTaskId" TEXT NOT NULL,
    "userVerificationTaskId" TEXT,
    "action" "VerificationAction" NOT NULL,
    "result" "VerificationResultStatus" NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformAccount_platform_idx" ON "PlatformAccount"("platform");

-- CreateIndex
CREATE INDEX "PlatformAccount_platformUserId_idx" ON "PlatformAccount"("platformUserId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformAccount_userId_platform_key" ON "PlatformAccount"("userId", "platform");

-- CreateIndex
CREATE INDEX "VerificationTask_platform_idx" ON "VerificationTask"("platform");

-- CreateIndex
CREATE INDEX "VerificationTask_isActive_idx" ON "VerificationTask"("isActive");

-- CreateIndex
CREATE INDEX "UserVerificationTask_userId_idx" ON "UserVerificationTask"("userId");

-- CreateIndex
CREATE INDEX "UserVerificationTask_verificationTaskId_idx" ON "UserVerificationTask"("verificationTaskId");

-- CreateIndex
CREATE INDEX "UserVerificationTask_status_idx" ON "UserVerificationTask"("status");

-- CreateIndex
CREATE UNIQUE INDEX "UserVerificationTask_userId_verificationTaskId_key" ON "UserVerificationTask"("userId", "verificationTaskId");

-- CreateIndex
CREATE INDEX "VerificationLog_userId_idx" ON "VerificationLog"("userId");

-- CreateIndex
CREATE INDEX "VerificationLog_verificationTaskId_idx" ON "VerificationLog"("verificationTaskId");

-- CreateIndex
CREATE INDEX "VerificationLog_userVerificationTaskId_idx" ON "VerificationLog"("userVerificationTaskId");

-- CreateIndex
CREATE INDEX "VerificationLog_createdAt_idx" ON "VerificationLog"("createdAt");

-- AddForeignKey
ALTER TABLE "PlatformAccount" ADD CONSTRAINT "PlatformAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserVerificationTask" ADD CONSTRAINT "UserVerificationTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserVerificationTask" ADD CONSTRAINT "UserVerificationTask_verificationTaskId_fkey" FOREIGN KEY ("verificationTaskId") REFERENCES "VerificationTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationLog" ADD CONSTRAINT "VerificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationLog" ADD CONSTRAINT "VerificationLog_verificationTaskId_fkey" FOREIGN KEY ("verificationTaskId") REFERENCES "VerificationTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationLog" ADD CONSTRAINT "VerificationLog_userVerificationTaskId_fkey" FOREIGN KEY ("userVerificationTaskId") REFERENCES "UserVerificationTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
