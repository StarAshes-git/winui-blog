#!/bin/bash
set -e

echo "Installing frontend dependencies..."
cd frontend
npm install

echo "Building frontend..."
npm run build

echo "Deploying to Cloudflare Workers..."
cd ..
npx wrangler deploy

echo "Done!"
