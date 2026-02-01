#!/usr/bin/env bash
set -euo pipefail

echo "📦 Building @sooth/sdk-core before mobile app dependencies..."

# Navigate to sdk-core
cd ../../packages/sdk-core

# Install sdk-core dependencies
pnpm install --frozen-lockfile

# Build sdk-core
pnpm build

echo "✅ @sooth/sdk-core built successfully"
