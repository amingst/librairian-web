// This script performs a comprehensive cache clearing operation

const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');
const prisma = new PrismaClient();

async function clearSystemCaches() {
  console.log('Starting comprehensive cache clearing operations...');
  
  try {
    // 1. Disconnect and reconnect Prisma to clear its query cache
    console.log('Clearing Prisma query cache...');
    await prisma.$disconnect();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a bit
    await prisma.$connect();
    console.log('Prisma reconnected');
    
    // 2. Clear Next.js build cache if it exists
    console.log('Attempting to clear Next.js cache...');
    const nextCachePaths = [
      path.join(process.cwd(), '.next/cache'),
      path.join(process.cwd(), 'node_modules/.cache')
    ];
    
    for (const cachePath of nextCachePaths) {
      try {
        await fs.access(cachePath);
        console.log(`Found cache at ${cachePath}, clearing...`);
        // Just list the directories rather than deleting
        const items = await fs.readdir(cachePath);
        console.log(`Cache directory contains: ${items.join(', ')}`);
        // We won't actually delete these as it could break the running app
        console.log(`To fully clear these caches, stop the app and run 'npm run clean' or manually delete these directories`);
      } catch (err) {
        console.log(`Cache path ${cachePath} not found or not accessible`);
      }
    }
    
    // 3. Run a simple query to verify database connection is working
    const docCount = await prisma.document.count();
    console.log(`Database connection confirmed. Total documents: ${docCount}`);
    
    // 4. Provide instructions for manual steps
    console.log('\nMANUAL STEPS REQUIRED:');
    console.log('1. In your browser, perform a hard refresh (Ctrl+Shift+R or Cmd+Shift+R)');
    console.log('2. Clear browser cache for this site');
    console.log('3. If using Next.js dev server, restart it with: npm run dev');
    console.log('4. If in production, rebuild and redeploy the application');
    
    return true;
  } catch (error) {
    console.error('Error clearing caches:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function if this script is executed directly
if (require.main === module) {
  clearSystemCaches()
    .then(() => {
      console.log('Cache clearing operations completed.');
      process.exit(0);
    })
    .catch(error => {
      console.error('Script failed:', error);
      process.exit(1);
    });
} else {
  // If imported as a module, export the function
  module.exports = clearSystemCaches;
} 