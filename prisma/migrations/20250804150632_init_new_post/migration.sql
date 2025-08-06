-- CreateTable
CREATE TABLE "public"."Post" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "webUrl" TEXT,
    "nsfw" BOOLEAN NOT NULL DEFAULT false,
    "tagItems" TEXT[],
    "post" JSONB,
    "blockchain" TEXT NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Post_name_idx" ON "public"."Post"("name");

-- CreateIndex
CREATE INDEX "Post_date_idx" ON "public"."Post"("date");

-- CreateIndex
CREATE INDEX "Post_blockchain_idx" ON "public"."Post"("blockchain");
