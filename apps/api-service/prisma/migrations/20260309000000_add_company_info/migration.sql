-- CreateTable
CREATE TABLE "CompanyInfo" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "description" TEXT,
    "industry" TEXT,
    "founded" INTEGER,
    "headquarters" TEXT,
    "website" TEXT,
    "employeeCount" TEXT,
    "revenue" TEXT,
    "companySize" TEXT,
    "fundingTotal" TEXT,
    "lastFunding" TEXT,
    "investors" TEXT[],
    "logoUrl" TEXT,
    "avgSalary" TEXT,
    "glassdoorRating" DOUBLE PRECISION,
    "benefits" TEXT[],
    "linkedinUrl" TEXT,
    "twitterHandle" TEXT,
    "githubUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT,

    CONSTRAINT "CompanyInfo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyInfo_companyName_key" ON "CompanyInfo"("companyName");

-- CreateIndex
CREATE INDEX "CompanyInfo_companyName_idx" ON "CompanyInfo"("companyName");

-- AlterTable: Add companyInfoId to InterviewProcess
ALTER TABLE "InterviewProcess" ADD COLUMN "companyInfoId" TEXT;

-- CreateIndex
CREATE INDEX "InterviewProcess_companyInfoId_idx" ON "InterviewProcess"("companyInfoId");

-- AddForeignKey
ALTER TABLE "InterviewProcess" ADD CONSTRAINT "InterviewProcess_companyInfoId_fkey" FOREIGN KEY ("companyInfoId") REFERENCES "CompanyInfo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
