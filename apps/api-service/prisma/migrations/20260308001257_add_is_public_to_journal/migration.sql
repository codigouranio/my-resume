-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('LIKE', 'HEART', 'MEDAL', 'AWARD', 'FIRE', 'LAUGH', 'THUMBSUP', 'CUSTOM');

-- CreateTable
CREATE TABLE "JournalPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "includeInAI" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "JournalPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalPostAttachment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalPostAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalPostReaction" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "reactionType" "ReactionType" NOT NULL,
    "customEmoji" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalPostReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalPostReply" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "JournalPostReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostResumeTag" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostResumeTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JournalPost_userId_idx" ON "JournalPost"("userId");

-- CreateIndex
CREATE INDEX "JournalPost_publishedAt_idx" ON "JournalPost"("publishedAt");

-- CreateIndex
CREATE INDEX "JournalPost_includeInAI_idx" ON "JournalPost"("includeInAI");

-- CreateIndex
CREATE INDEX "JournalPost_isPublic_idx" ON "JournalPost"("isPublic");

-- CreateIndex
CREATE INDEX "JournalPost_deletedAt_idx" ON "JournalPost"("deletedAt");

-- CreateIndex
CREATE INDEX "JournalPostAttachment_postId_idx" ON "JournalPostAttachment"("postId");

-- CreateIndex
CREATE INDEX "JournalPostReaction_postId_idx" ON "JournalPostReaction"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalPostReaction_postId_reactionType_key" ON "JournalPostReaction"("postId", "reactionType");

-- CreateIndex
CREATE INDEX "JournalPostReply_postId_idx" ON "JournalPostReply"("postId");

-- CreateIndex
CREATE INDEX "JournalPostReply_createdAt_idx" ON "JournalPostReply"("createdAt");

-- CreateIndex
CREATE INDEX "PostResumeTag_postId_idx" ON "PostResumeTag"("postId");

-- CreateIndex
CREATE INDEX "PostResumeTag_resumeId_idx" ON "PostResumeTag"("resumeId");

-- CreateIndex
CREATE UNIQUE INDEX "PostResumeTag_postId_resumeId_key" ON "PostResumeTag"("postId", "resumeId");

-- AddForeignKey
ALTER TABLE "JournalPost" ADD CONSTRAINT "JournalPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalPostAttachment" ADD CONSTRAINT "JournalPostAttachment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "JournalPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalPostReaction" ADD CONSTRAINT "JournalPostReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "JournalPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalPostReply" ADD CONSTRAINT "JournalPostReply_postId_fkey" FOREIGN KEY ("postId") REFERENCES "JournalPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostResumeTag" ADD CONSTRAINT "PostResumeTag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "JournalPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostResumeTag" ADD CONSTRAINT "PostResumeTag_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;
