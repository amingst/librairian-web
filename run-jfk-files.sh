#!/bin/bash
set -e

echo "Running Prisma migrations..."
npx prisma migrate dev --name add-processing-status

echo "Starting Next.js application..."
npm run dev 