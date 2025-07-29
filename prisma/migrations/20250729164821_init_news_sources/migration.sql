-- CreateTable
CREATE TABLE "NewsSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "icon" TEXT,
    "selectors" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDisabled" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsSource_name_key" ON "NewsSource"("name");

-- CreateIndex
CREATE INDEX "NewsSource_name_idx" ON "NewsSource"("name");

-- CreateIndex
CREATE INDEX "NewsSource_isActive_idx" ON "NewsSource"("isActive");

-- CreateIndex
CREATE INDEX "NewsSource_isDisabled_idx" ON "NewsSource"("isDisabled");
