-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "documentGroup" TEXT;

-- CreateIndex
CREATE INDEX "Document_documentGroup_idx" ON "Document"("documentGroup");
