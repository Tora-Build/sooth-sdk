import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SoothProtocol } from "../target/types/sooth_protocol";

async function main() {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SoothProtocol as Program<SoothProtocol>;

  // Get Mint from Env
  const usdcMintKey = process.env.USDC_MINT;
  if (!usdcMintKey) {
    throw new Error("Please set USDC_MINT env var");
  }
  const usdcMint = new anchor.web3.PublicKey(usdcMintKey);
  console.log("Using USDC Mint:", usdcMint.toString());

  console.log("Initializing Trader Vault (v2)...");
  // Derive Trader Vault PDA (v2)
  const [traderVault] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("trader_vault_v2")],
    program.programId
  );
  // Derive Token Account PDA
  const [vaultTokenAccount] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault_token_account_v2"), traderVault.toBuffer()],
    program.programId
  );

  try {
    const tx = await program.methods
      .initializeTraderVault()
      .accounts({
        authority: provider.wallet.publicKey,
        usdcMint: usdcMint,
      })
      .rpc();
    console.log("✅ Trader Vault initialized:", traderVault.toString());
    console.log("Tx:", tx);
  } catch (e: any) {
    if (e.message.includes("already in use")) {
      console.log("⚠️ Trader Vault already initialized:", traderVault.toString());
    } else {
      console.error("Error initializing Trader Vault:", e);
    }
  }

  console.log("\nInitializing Governor Vault (v2)...");
  // Derive Governor Vault PDA (v2)
  const [governorVault] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("governor_vault_v2")],
    program.programId
  );

  try {
    const tx = await program.methods
      .initializeGovernorVault(
        new anchor.BN("10000000000000000000000"), // default_b_base (10k USDC)
        50,                           // default_fee_bps (0.5%)
        1000                          // reserve_factor_bps (10%)
      )
      .accounts({
        authority: provider.wallet.publicKey,
        usdcMint: usdcMint,
      })
      .rpc();
    console.log("✅ Governor Vault initialized:", governorVault.toString());
    console.log("Tx:", tx);
  } catch (e: any) {
    if (e.message.includes("already in use")) {
      console.log("⚠️ Governor Vault already initialized:", governorVault.toString());
    } else {
      console.error("Error initializing Governor Vault:", e);
    }
  }
}

main().then(
  () => process.exit(),
  (err) => {
    console.error(err);
    process.exit(-1);
  }
);
