-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "archiveId" TEXT,
ADD COLUMN     "lastProcessed" TIMESTAMP(3),
ADD COLUMN     "processingError" TEXT,
ADD COLUMN     "processingStage" TEXT,
ADD COLUMN     "processingSteps" TEXT[];

-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "hasImage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasText" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "processedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Document_processingStage_idx" ON "Document"("processingStage");

-- CreateIndex
CREATE INDEX "Document_archiveId_idx" ON "Document"("archiveId");

-- CreateIndex
CREATE INDEX "Page_hasImage_idx" ON "Page"("hasImage");

-- CreateIndex
CREATE INDEX "Page_hasText_idx" ON "Page"("hasText");
