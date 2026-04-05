/*
  Warnings:

  - You are about to drop the `Session` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "OtpToken" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'STEP_UP';

-- DropTable
DROP TABLE "Session";

-- CreateIndex
CREATE INDEX "OtpToken_userId_purpose_createdAt_idx" ON "OtpToken"("userId", "purpose", "createdAt");
