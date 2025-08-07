-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "title" TEXT;

-- CreateIndex
CREATE INDEX "Post_sourceId_idx" ON "Post"("sourceId");

-- CreateIndex
CREATE INDEX "Post_title_idx" ON "Post"("title");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "NewsSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
