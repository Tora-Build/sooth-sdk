import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SoothProtocol } from "../target/types/sooth_protocol";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SoothProtocol as Program<SoothProtocol>;

  const marketId = new anchor.BN(2);
  const [market] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("market"), marketId.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  console.log(`Creating Market ID ${marketId.toString()}...`);
  console.log("Market PDA:", market.toString());

  try {
    const tx = await program.methods
      .createMarket(
        marketId,
        new anchor.BN("1000000000000000000000"),  // b_param (1000 USDC)
        100                          // fee_bps (1%)
      )
      .accounts({
        governor: provider.wallet.publicKey,
      })
      .rpc();
    console.log("✅ Market created:", market.toString());
    console.log("Tx:", tx);
  } catch (e: any) {
    if (e.message.includes("already in use")) {
      console.log("⚠️ Market already exists:", market.toString());
    } else {
      console.error("Error creating market:", e);
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
