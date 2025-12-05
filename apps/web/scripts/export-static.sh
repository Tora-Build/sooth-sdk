#!/usr/bin/env bash
set -euo pipefail

# Export a hostable static bundle into deploy/hostable-site
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT/deploy/hostable-site"

echo "Building Vite bundle..."
cd "$ROOT"
npm run build

echo "Exporting to $OUT_DIR..."
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
rsync -a "$ROOT/dist/" "$OUT_DIR/"

# SPA fallback for static hosts (Netlify, S3, Cloudflare Pages)
echo "/* /index.html 200" > "$OUT_DIR/_redirects"

echo "Done. Host everything in deploy/hostable-site/"
