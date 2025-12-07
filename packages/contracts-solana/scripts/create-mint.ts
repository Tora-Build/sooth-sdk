import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { 
  createMint, 
  getOrCreateAssociatedTokenAccount, 
  mintTo, 
  TOKEN_PROGRAM_ID 
} from "@solana/spl-token";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const payer = (provider.wallet as anchor.Wallet).payer;
  console.log("Payer:", payer.publicKey.toString());

  // Create Mint (6 decimals for USDC)
  console.log("Creating Mint...");
  const mint = await createMint(
    provider.connection,
    payer,
    payer.publicKey, // mint authority
    null, // freeze authority
    6 // decimals
  );
  console.log("✅ Mint Created:", mint.toString());

  // Get or Create ATA for Payer
  console.log("Creating ATA for Payer...");
  const payerAta = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    payer,
    mint,
    payer.publicKey
  );
  console.log("ATA:", payerAta.address.toString());

  // Mint Tokens to Payer (1M USDC)
  console.log("Minting 1,000,000 USDC to payer...");
  await mintTo(
    provider.connection,
    payer,
    mint,
    payerAta.address,
    payer,
    1_000_000 * 1_000_000 // 1M * 10^6
  );
  console.log("✅ Minted!");

  console.log("\nCopy this Mint address for usage:");
  console.log(mint.toString());
}

main().catch(console.error);
