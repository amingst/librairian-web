const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');
const { normalizeAllDates } = require('../lib/dateUtils');

// Initialize Prisma client
const prisma = new PrismaClient();
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.oip.onl';

// Explicitly set limit to Infinity (no test mode)
const limit = Infinity;

// Rest of your script (copy from populateDb.ts)
async function fetchDocumentIds(page = 1, pageSize = 100) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/jfk/list?page=${page}&limit=${pageSize}&excludeNoAnalysis=true`);
    if (!response.ok) {
      throw new Error(`API response error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching document IDs:', error);
    return { documents: [], hasMore: false };
  }
}

// ... rest of your functions

// Run the population script
populateDatabase()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  }); 