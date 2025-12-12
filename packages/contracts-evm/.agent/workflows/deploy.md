---
description: How to deploy contracts to testnet
---

# Deploy Contracts

// turbo-all

1. Ensure `.env` is configured with `PRIVATE_KEY` and `RPC_URL`

2. Build contracts

```bash
forge build
```

3. Run deployment script

```bash
./deploy-and-sync.sh
```

4. Verify deployment artifacts updated

```bash
cat deployments.json
```

5. Sync docs to frontend

```bash
cd ../.. && ./sync-fe-docs.sh
```
