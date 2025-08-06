/*
  Warnings:

  - You are about to drop the column `blockchain` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `nsfw` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `post` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `sourceId` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `tagItems` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the `ArticleMedia` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NewsArticle` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `articleText` to the `Post` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bylineWriter` to the `Post` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bylineWritersTitle` to the `Post` table without a default value. This is not possible if the table is not empty.
  - Made the column `webUrl` on table `Post` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."ArticleMedia" DROP CONSTRAINT "ArticleMedia_articleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."NewsArticle" DROP CONSTRAINT "NewsArticle_sourceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Post" DROP CONSTRAINT "Post_sourceId_fkey";

-- DropIndex
DROP INDEX "public"."Post_blockchain_idx";

-- DropIndex
DROP INDEX "public"."Post_date_idx";

-- DropIndex
DROP INDEX "public"."Post_name_idx";

-- AlterTable
ALTER TABLE "public"."Post" DROP COLUMN "blockchain",
DROP COLUMN "date",
DROP COLUMN "description",
DROP COLUMN "name",
DROP COLUMN "nsfw",
DROP COLUMN "post",
DROP COLUMN "sourceId",
DROP COLUMN "tagItems",
ADD COLUMN     "articleText" TEXT NOT NULL,
ADD COLUMN     "audioCaptionItems" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "audioItems" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "bylineWriter" TEXT NOT NULL,
ADD COLUMN     "bylineWritersLocation" TEXT,
ADD COLUMN     "bylineWritersTitle" TEXT NOT NULL,
ADD COLUMN     "featuredImage" TEXT,
ADD COLUMN     "imageCaptionItems" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "imageItems" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "replyTo" TEXT,
ADD COLUMN     "videoItems" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "webUrl" SET NOT NULL;

-- DropTable
DROP TABLE "public"."ArticleMedia";

-- DropTable
DROP TABLE "public"."NewsArticle";

-- DropEnum
DROP TYPE "public"."MediaType";

-- CreateTable
CREATE TABLE "public"."Text" (
    "id" TEXT NOT NULL,
    "webUrl" TEXT NOT NULL,
    "arweaveAddress" TEXT NOT NULL,
    "ipfsAddress" TEXT NOT NULL,
    "bittorrentAddress" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,

    CONSTRAINT "Text_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Image" (
    "id" TEXT NOT NULL,
    "webUrl" TEXT NOT NULL,
    "arweaveAddress" TEXT NOT NULL,
    "ipfsAddress" TEXT NOT NULL,
    "bittorrentAddress" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "creator" JSONB NOT NULL,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Podcast" (
    "id" TEXT NOT NULL,
    "show" TEXT NOT NULL,
    "episodeNum" INTEGER NOT NULL,
    "seasonNum" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "hosts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "guests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "explicit" BOOLEAN NOT NULL DEFAULT false,
    "transcript" TEXT,
    "chapters" TEXT,
    "episodeArtwork" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "podcastArtwork" TEXT NOT NULL,
    "license" TEXT,
    "copyright" TEXT,
    "sponsors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rssFeedUrl" TEXT NOT NULL,

    CONSTRAINT "Podcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Video" (
    "id" TEXT NOT NULL,
    "webUrl" TEXT NOT NULL,
    "arweaveAddress" TEXT NOT NULL,
    "ipfsAddress" TEXT NOT NULL,
    "bittorrentAddress" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "thumbnails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "creator" JSONB NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Audio" (
    "id" TEXT NOT NULL,
    "webUrl" TEXT NOT NULL,
    "arweaveAddress" TEXT NOT NULL,
    "ipfsAddress" TEXT NOT NULL,
    "bittorrentAddress" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "thumbnails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "creator" JSONB NOT NULL,

    CONSTRAINT "Audio_pkey" PRIMARY KEY ("id")
);
