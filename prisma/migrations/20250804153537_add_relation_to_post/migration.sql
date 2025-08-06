/*
  Warnings:

  - Added the required column `sourceId` to the `Post` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Post" ADD COLUMN     "sourceId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."Post" ADD CONSTRAINT "Post_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "public"."NewsSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
