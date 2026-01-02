---
description: How to run the frontend development server
---

# Frontend Dev Server Workflow

Start the frontend development server for local testing.

## Quick Start

```bash
// turbo
cd apps/web && npm run dev
```

Dev server runs on http://localhost:5173

## Full Setup (First Time)

```bash
# From repo root
// turbo
pnpm install

// turbo
cd apps/web && npm run dev
```

## Common Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run linter |

## Troubleshooting

### Port Already in Use

```bash
// turbo
lsof -i :5173
kill -9 <PID>
```

### Dependencies Out of Sync

```bash
// turbo
cd ../.. && pnpm install
```

### Contract Changes Not Reflected

```bash
// turbo
cd ../.. && ./sync-deployments.sh
```

Then restart dev server.
