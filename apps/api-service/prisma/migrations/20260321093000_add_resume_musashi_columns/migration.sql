-- AlterTable: Persist Musashi Index results in dedicated Resume columns
ALTER TABLE "Resume" ADD COLUMN "musashiImScore" DOUBLE PRECISION;
ALTER TABLE "Resume" ADD COLUMN "musashiEquivalent" TEXT;
ALTER TABLE "Resume" ADD COLUMN "musashiUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Resume" ADD COLUMN "musashiRawJson" JSONB;

-- Index for sorting/filtering by freshness of Musashi data
CREATE INDEX "Resume_musashiUpdatedAt_idx" ON "Resume"("musashiUpdatedAt");

-- Backfill from legacy customCss markers (best effort)
UPDATE "Resume"
SET
	"musashiImScore" = COALESCE(
		"musashiImScore",
		NULLIF((regexp_match("customCss", '/\\* resumecast:musashi-im-score=([0-9.]+) \\*/'))[1], '')::DOUBLE PRECISION
	),
	"musashiEquivalent" = COALESCE(
		"musashiEquivalent",
		NULLIF((regexp_match("customCss", '/\\* resumecast:musashi-equivalent=(.*?) \\*/'))[1], '')
	),
	"musashiUpdatedAt" = COALESCE(
		"musashiUpdatedAt",
		NULLIF((regexp_match("customCss", '/\\* resumecast:musashi-updated-at=(.*?) \\*/'))[1], '')::TIMESTAMP
	)
WHERE "customCss" IS NOT NULL;
