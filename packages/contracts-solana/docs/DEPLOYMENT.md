# Deployment Guide

## Prerequisites

```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Install Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.32.1
avm use 0.32.1

# Verify installations
solana --version  # Should be 3.0.13+
anchor --version  # Should be 0.32.1
```

## Configuration

### 1. Generate Keypair

```bash
# Generate deployer keypair
solana-keygen new -o ~/.config/solana/id.json

# Get your address
solana address
```

### 2. Set Network

```bash
# Devnet
solana config set --url https://api.devnet.solana.com

# Mainnet (when ready)
# solana config set --url https://api.mainnet-beta.solana.com
```

### 3. Fund Account

```bash
# Devnet airdrop
solana airdrop 2

# Check balance
solana balance
```

## Build

```bash
cd packages/contracts-solana
anchor build
```

## Deploy to Devnet

### 1. Deploy Program

```bash
anchor deploy

# Output will show:
# Program Id: <YOUR_PROGRAM_ID>
```

### 2. Update Program ID

```bash
# Update Anchor.toml
[programs.devnet]
sooth_protocol = "<YOUR_PROGRAM_ID>"

# Update lib.rs
declare_id!("<YOUR_PROGRAM_ID>");

# Rebuild
anchor build
```

### 3. Initialize Vaults

```typescript
// initialize-vaults.ts
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SoothProtocol } from "../target/types/sooth_protocol";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SoothProtocol as Program<SoothProtocol>;

  // Initialize Trader Vault
  const [traderVault] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("trader_vault")],
    program.programId
  );

  await program.methods
    .initializeTraderVault()
    .accounts({
      authority: provider.wallet.publicKey,
      traderVault,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  console.log("✅ Trader Vault:", traderVault.toString());

  // Initialize Governor Vault
  const [governorVault] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("governor_vault")],
    program.programId
  );

  await program.methods
    .initializeGovernorVault(
      new anchor.BN(10000 * 1e18), // default_b_base
      50, // default_fee_bps (0.5%)
      1000 // reserve_factor_bps (10%)
    )
    .accounts({
      authority: provider.wallet.publicKey,
      governorVault,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  console.log("✅ Governor Vault:", governorVault.toString());
}

main();
```

Run:

```bash
ts-node scripts/initialize-vaults.ts
```

### 4. Create Test Market

```typescript
// create-market.ts
const marketId = new anchor.BN(1);
const [market] = anchor.web3.PublicKey.findProgramAddressSync(
  [Buffer.from("market"), marketId.toArrayLike(Buffer, "le", 8)],
  program.programId
);

await program.methods
  .createMarket(
    marketId,
    new anchor.BN(1000), // b_param
    100 // fee_bps (1%)
  )
  .accounts({
    governor: provider.wallet.publicKey,
    market,
    systemProgram: anchor.web3.SystemProgram.programId,
  })
  .rpc();

console.log("✅ Market:", market.toString());
```

## Verify Deployment

```bash
# Check program account
solana account <PROGRAM_ID>

# Check trader vault
solana account <TRADER_VAULT_PDA>

# Check governor vault
solana account <GOVERNOR_VAULT_PDA>
```

## Mainnet Deployment

### Additional Steps

1. **Audit**: Get professional security audit
2. **Upgrade Authority**: Consider multisig
3. **Monitoring**: Set up alerts for program activity
4. **Keeper Bots**: Deploy orderbook matching bots

### Mainnet Checklist

- [ ] Security audit complete
- [ ] Testnet testing complete (100+ txs)
- [ ] Upgrade authority configured
- [ ] Monitoring infrastructure ready
- [ ] Emergency pause mechanism tested
- [ ] Documentation complete
- [ ] Frontend integration tested

## Troubleshooting

### "Insufficient funds"

```bash
solana airdrop 2  # Devnet only
```

### "Program failed to complete"

Check CU limits:

```bash
solana logs | grep "consumed"
```

### "Account already exists"

Vaults already initialized. Use existing PDAs.

## Useful Commands

```bash
# View program logs
solana logs <PROGRAM_ID>

# Get program data
anchor idl fetch <PROGRAM_ID> -o target/idl/sooth_protocol.json

# Upgrade program (if authority)
anchor upgrade target/deploy/sooth_protocol.so --program-id <PROGRAM_ID>
```
