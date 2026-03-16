-- AlterTable: Add AI analysis fields to InterviewProcess
ALTER TABLE "InterviewProcess" ADD COLUMN "fitScore" DOUBLE PRECISION;
ALTER TABLE "InterviewProcess" ADD COLUMN "fitAnalysis" TEXT;
