#!/usr/bin/env bash
# Quick build script for React app
set -e

echo "🏗️  Building React application..."

cd "$(dirname "$0")"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the app
echo "⚡ Running build..."
npm run build

echo "✅ Build complete! Output in dist/"
