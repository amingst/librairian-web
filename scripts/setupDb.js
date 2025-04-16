#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Create a readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Check for environment variables or prompt for configuration
function setupEnvironment() {
  const envPath = path.join(process.cwd(), '.env');
  
  // Check if .env already exists
  if (fs.existsSync(envPath)) {
    console.log('Found existing .env file. To reconfigure database, delete this file and run setup again.');
    return Promise.resolve();
  }
  
  return new Promise((resolve) => {
    console.log('JFK Documents Database Setup');
    console.log('============================');
    console.log('This script will help you set up PostgreSQL for the JFK Documents database.');
    
    rl.question('PostgreSQL host (default: localhost): ', (host) => {
      host = host || 'localhost';
      
      rl.question('PostgreSQL port (default: 5432): ', (port) => {
        port = port || '5432';
        
        rl.question('PostgreSQL username: ', (username) => {
          if (!username) {
            console.log('Username is required for PostgreSQL');
            process.exit(1);
          }
          
          rl.question('PostgreSQL password (leave blank if none): ', (password) => {
            rl.question('Database name (default: jfk_documents): ', (dbName) => {
              dbName = dbName || 'jfk_documents';
              
              const connectionString = `postgresql://${username}${password ? `:${password}` : ''}@${host}:${port}/${dbName}?schema=public`;
              
              fs.writeFileSync(envPath, `DATABASE_URL="${connectionString}"\n`);
              console.log(`Database connection configured in .env file.`);
              
              resolve();
            });
          });
        });
      });
    });
  });
}

// Check if PostgreSQL is installed
function checkPostgresql() {
  try {
    execSync('which psql', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Run database migrations
function runMigrations() {
  try {
    console.log('Running database migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    console.log('Database schema created successfully!');
  } catch (error) {
    console.error('Failed to run migrations:', error.message);
    console.log('Please make sure PostgreSQL is running and accessible with the provided credentials.');
    console.log('You can run migrations manually with: npm run db:migrate');
  }
}

// Main function
async function main() {
  if (!checkPostgresql()) {
    console.warn(`
PostgreSQL does not appear to be installed or in your PATH.
Please install PostgreSQL:
- On Ubuntu/Debian: sudo apt install postgresql
- On CentOS/RHEL: sudo yum install postgresql-server
- On macOS: brew install postgresql
    `);
  }
  
  await setupEnvironment();
  
  rl.question('Would you like to run database migrations now? (Y/n) ', (answer) => {
    if (answer.toLowerCase() !== 'n') {
      runMigrations();
    } else {
      console.log('Skipping migrations. Run them later with: npm run db:migrate');
    }
    
    rl.close();
  });
}

// Handle clean exit
rl.on('close', () => {
  console.log('Database setup completed.');
});

// Run the setup
main().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
}); 