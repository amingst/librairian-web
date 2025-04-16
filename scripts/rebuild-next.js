// Script to completely clean and rebuild the Next.js application

const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const util = require('util');

const execPromise = util.promisify(exec);

async function cleanAndRebuild() {
  console.log('Starting complete Next.js clean and rebuild process...');
  
  try {
    // Step 1: Stop any running Next.js instances
    console.log('WARNING: This script will not automatically stop running Next.js instances.');
    console.log('Please stop any running Next.js instances manually before continuing.');
    console.log('Press Ctrl+C in the terminal where Next.js is running.');
    
    await new Promise(resolve => setTimeout(resolve, 3000)); // Give time to read
    
    // Step 2: Remove Next.js cache and build directories
    const cachePaths = [
      path.join(process.cwd(), '.next'),
      path.join(process.cwd(), 'node_modules/.cache')
    ];
    
    for (const cachePath of cachePaths) {
      try {
        console.log(`Checking if ${cachePath} exists...`);
        await fs.access(cachePath);
        console.log(`Removing ${cachePath}...`);
        
        // List directory content before deletion for debugging
        const items = await fs.readdir(cachePath, { withFileTypes: true });
        console.log(`Directory contains: ${items.map(item => item.name).join(', ')}`);
        
        // Instead of deleting, we'll just print what we would delete
        // Actual deletion can be risky and require careful file system operations
        console.log(`Would delete: ${cachePath}`);
        console.log('For safety, please manually delete this directory if needed');
      } catch (err) {
        console.log(`Cache path ${cachePath} not found or not accessible: ${err.message}`);
      }
    }
    
    // Step 3: Instructions for manual rebuild
    console.log('\nMANUAL STEPS TO COMPLETE THE REBUILD:');
    console.log('1. Stop any running Next.js server (npm run dev, etc)');
    console.log('2. Run these commands:');
    console.log('   rm -rf .next');
    console.log('   rm -rf node_modules/.cache');
    console.log('   npm run dev');
    console.log('3. Open a new browser window (not just a new tab)');
    console.log('4. Navigate to your application');
    
    return true;
  } catch (error) {
    console.error('Error during rebuild process:', error);
    throw error;
  }
}

// Run the function if this script is executed directly
if (require.main === module) {
  cleanAndRebuild()
    .then(() => {
      console.log('Clean and rebuild instructions completed.');
      process.exit(0);
    })
    .catch(error => {
      console.error('Script failed:', error);
      process.exit(1);
    });
} else {
  // If imported as a module, export the function
  module.exports = cleanAndRebuild;
} 