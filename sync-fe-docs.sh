#!/bin/bash

# Sync frontend integration docs to apps/web
# One-way sync: empties destination and copies all files

set -e

SOURCE_DIR="$(dirname "$0")/packages/contracts-evm/docs/technical/frontend-integration"
DEST_DIR="$(dirname "$0")/apps/web/docs/contract-integration"

echo "🔄 Syncing frontend integration docs..."
echo "   Source: $SOURCE_DIR"
echo "   Dest:   $DEST_DIR"

# Check source exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ Source directory not found: $SOURCE_DIR"
    exit 1
fi

# Create destination if needed
mkdir -p "$DEST_DIR"

# Empty destination folder
echo "🗑️  Clearing destination..."
rm -rf "$DEST_DIR"/*

# Copy all files (excluding .DS_Store)
echo "📋 Copying files..."
find "$SOURCE_DIR" -type f ! -name ".DS_Store" -exec cp {} "$DEST_DIR/" \;

# Count files
FILE_COUNT=$(ls -1 "$DEST_DIR" | wc -l | tr -d ' ')

echo "✅ Synced $FILE_COUNT files to $DEST_DIR"
echo ""
echo "Files synced:"
ls -la "$DEST_DIR"
