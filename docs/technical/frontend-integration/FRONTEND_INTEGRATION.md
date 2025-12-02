# Connecting Sooth Contracts to Frontend

This guide explains how to connect your external frontend (Next.js, React, etc.) to the Sooth Protocol smart contracts.

## 1. Deploy Contracts

Run the deployment script to deploy the contracts to your target network (or local Anvil node).

```bash
# For local Anvil
forge script script/DeploySooth.s.sol --rpc-url http://127.0.0.1:8545 --private-key $PRIVATE_KEY --broadcast

# For Testnet/Mainnet
forge script script/DeploySooth.s.sol --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
```

## 2. Locate Artifacts

After deployment, the script will generate a `deployments.json` file in the root directory.

**`deployments.json`** contains the addresses of all deployed contracts:
```json
{
  "MockERC20": "0x...",
  "SoothVault": "0x...",
  "SoothRiskManager": "0x...",
  ...
}
```

**ABIs** are located in the `out/` directory. For example:
- `out/SoothVault.sol/SoothVault.json`
- `out/SoothMarket.sol/SoothMarket.json`

## 3. Copy to Frontend

Copy `deployments.json` and the necessary ABIs to your frontend repository.

**Recommended Structure:**
```
frontend/
  src/
    config/
      deployments.json
      abis/
        SoothVault.json
        SoothMarket.json
        ...
```

## 4. Example Usage (wagmi / viem)

```typescript
import { useContractRead, useContractWrite } from 'wagmi';
import deployments from '../config/deployments.json';
import SoothVaultABI from '../config/abis/SoothVault.json';

// Read from Vault
const { data: totalAssets } = useContractRead({
  address: deployments.SoothVault,
  abi: SoothVaultABI.abi,
  functionName: 'totalAssets',
});

// Write to Vault (Deposit)
const { write: deposit } = useContractWrite({
  address: deployments.SoothVault,
  abi: SoothVaultABI.abi,
  functionName: 'depositFor',
});
```

## 5. Example Usage (ethers.js)

```typescript
import { ethers } from 'ethers';
import deployments from '../config/deployments.json';
import SoothVaultABI from '../config/abis/SoothVault.json';

const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();

const vault = new ethers.Contract(
  deployments.SoothVault,
  SoothVaultABI.abi,
  signer
);

// Call function
await vault.depositFor(userAddress, amount);
```
