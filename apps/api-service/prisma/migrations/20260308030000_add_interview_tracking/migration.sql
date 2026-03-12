-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('APPLIED', 'SCREENING', 'TECHNICAL', 'ONSITE', 'FINAL_ROUND', 'OFFER', 'NEGOTIATING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "InterviewProcess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "jobUrl" TEXT,
    "description" TEXT,
    "status" "InterviewStatus" NOT NULL DEFAULT 'APPLIED',
    "skillTags" TEXT[],
    "resumeId" TEXT,
    "recruiterName" TEXT,
    "recruiterEmail" TEXT,
    "recruiterPhone" TEXT,
    "recruiterLinks" TEXT[],
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "InterviewProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewTimeline" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "statusChange" "InterviewStatus",
    "attachmentName" TEXT,
    "attachmentUrl" TEXT,
    "attachmentType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewReminder" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterviewProcess_userId_status_idx" ON "InterviewProcess"("userId", "status");

-- CreateIndex
CREATE INDEX "InterviewProcess_appliedAt_idx" ON "InterviewProcess"("appliedAt");

-- CreateIndex
CREATE INDEX "InterviewProcess_archivedAt_idx" ON "InterviewProcess"("archivedAt");

-- CreateIndex
CREATE INDEX "InterviewTimeline_interviewId_createdAt_idx" ON "InterviewTimeline"("interviewId", "createdAt");

-- CreateIndex
CREATE INDEX "InterviewReminder_dueAt_completed_idx" ON "InterviewReminder"("dueAt", "completed");

-- CreateIndex
CREATE INDEX "InterviewReminder_interviewId_idx" ON "InterviewReminder"("interviewId");

-- AddForeignKey
ALTER TABLE "InterviewProcess" ADD CONSTRAINT "InterviewProcess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewProcess" ADD CONSTRAINT "InterviewProcess_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewTimeline" ADD CONSTRAINT "InterviewTimeline_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "InterviewProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewReminder" ADD CONSTRAINT "InterviewReminder_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "InterviewProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;
