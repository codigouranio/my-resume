-- CreateEnum
CREATE TYPE "CorroborationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED', 'EXPIRED');

-- CreateTable
CREATE TABLE "PostCorroboration" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "corroboratorEmail" TEXT NOT NULL,
    "corroboratorName" TEXT NOT NULL,
    "corroboratorRole" TEXT,
    "status" "CorroborationStatus" NOT NULL DEFAULT 'PENDING',
    "token" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "comment" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostCorroboration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PostCorroboration_token_key" ON "PostCorroboration"("token");

-- CreateIndex
CREATE INDEX "PostCorroboration_postId_idx" ON "PostCorroboration"("postId");

-- CreateIndex
CREATE INDEX "PostCorroboration_token_idx" ON "PostCorroboration"("token");

-- CreateIndex
CREATE INDEX "PostCorroboration_status_idx" ON "PostCorroboration"("status");

-- AddForeignKey
ALTER TABLE "PostCorroboration" ADD CONSTRAINT "PostCorroboration_postId_fkey" FOREIGN KEY ("postId") REFERENCES "JournalPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
