-- CreateEnum
CREATE TYPE "EnrichmentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "CompanyInfo" ADD COLUMN "enrichmentStatus" "EnrichmentStatus" NOT NULL DEFAULT 'PENDING';

-- Update existing records to COMPLETED (they already have data)
UPDATE "CompanyInfo" SET "enrichmentStatus" = 'COMPLETED' WHERE "description" IS NOT NULL OR "industry" IS NOT NULL;
