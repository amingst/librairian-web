-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "document" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "documentUrl" TEXT,
    "processingDate" TIMESTAMP(3),
    "pageCount" INTEGER,
    "title" TEXT,
    "summary" TEXT,
    "fullText" TEXT,
    "documentType" TEXT,
    "allNames" TEXT[],
    "allPlaces" TEXT[],
    "allDates" TEXT[],
    "allObjects" TEXT[],
    "stamps" TEXT[],
    "searchText" TEXT,
    "normalizedDates" TIMESTAMP(3)[],
    "earliestDate" TIMESTAMP(3),
    "latestDate" TIMESTAMP(3),
    "hasHandwrittenNotes" BOOLEAN NOT NULL DEFAULT false,
    "hasStamps" BOOLEAN NOT NULL DEFAULT false,
    "hasFullText" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "imagePath" TEXT NOT NULL,
    "summary" TEXT,
    "fullText" TEXT,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandwrittenNote" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "location" TEXT,

    CONSTRAINT "HandwrittenNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentStamp" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "type" TEXT,
    "date" TEXT,
    "text" TEXT NOT NULL,

    CONSTRAINT "DocumentStamp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Document_documentType_idx" ON "Document"("documentType");

-- CreateIndex
CREATE INDEX "Document_hasHandwrittenNotes_idx" ON "Document"("hasHandwrittenNotes");

-- CreateIndex
CREATE INDEX "Document_hasStamps_idx" ON "Document"("hasStamps");

-- CreateIndex
CREATE INDEX "Document_hasFullText_idx" ON "Document"("hasFullText");

-- CreateIndex
CREATE INDEX "Document_earliestDate_latestDate_idx" ON "Document"("earliestDate", "latestDate");

-- CreateIndex
CREATE INDEX "Page_pageNumber_idx" ON "Page"("pageNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Page_documentId_pageNumber_key" ON "Page"("documentId", "pageNumber");

-- CreateIndex
CREATE INDEX "HandwrittenNote_documentId_pageNumber_idx" ON "HandwrittenNote"("documentId", "pageNumber");

-- CreateIndex
CREATE INDEX "HandwrittenNote_content_idx" ON "HandwrittenNote"("content");

-- CreateIndex
CREATE INDEX "DocumentStamp_documentId_pageNumber_idx" ON "DocumentStamp"("documentId", "pageNumber");

-- CreateIndex
CREATE INDEX "DocumentStamp_type_idx" ON "DocumentStamp"("type");

-- CreateIndex
CREATE INDEX "DocumentStamp_date_idx" ON "DocumentStamp"("date");

-- CreateIndex
CREATE INDEX "DocumentStamp_text_idx" ON "DocumentStamp"("text");

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandwrittenNote" ADD CONSTRAINT "HandwrittenNote_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentStamp" ADD CONSTRAINT "DocumentStamp_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
