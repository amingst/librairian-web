const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function viewDocuments() {
  try {
    // Count total documents
    const count = await prisma.document.count();
    console.log(`Total documents: ${count}`);
    
    // Get documents with stamps
    const withStamps = await prisma.document.count({
      where: { hasStamps: true }
    });
    console.log(`Documents with stamps: ${withStamps}`);
    
    // Get documents with handwritten notes
    const withNotes = await prisma.document.count({
      where: { hasHandwrittenNotes: true }
    });
    console.log(`Documents with handwritten notes: ${withNotes}`);
    
    // Get documents with full text
    const withFullText = await prisma.document.count({
      where: { hasFullText: true }
    });
    console.log(`Documents with full text: ${withFullText}`);
    
    // Sample document details
    const sample = await prisma.document.findFirst({
      include: {
        pages: true,
        handwrittenNotes: true,
        documentStamps: true
      }
    });
    
    console.log("\nSample document:");
    console.log(JSON.stringify({
      id: sample.id,
      title: sample.title,
      summary: sample.summary,
      hasHandwrittenNotes: sample.hasHandwrittenNotes,
      hasStamps: sample.hasStamps,
      hasFullText: sample.hasFullText,
      pageCount: sample.pages.length,
      noteCount: sample.handwrittenNotes.length,
      stampCount: sample.documentStamps.length
    }, null, 2));
    
  } catch (error) {
    console.error("Error viewing database:", error);
  } finally {
    await prisma.$disconnect();
  }
}

viewDocuments(); 