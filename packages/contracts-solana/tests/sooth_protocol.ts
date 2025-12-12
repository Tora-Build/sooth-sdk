import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SoothProtocol } from "../target/types/sooth_protocol";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";

describe("sooth_protocol", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SoothProtocol as Program<SoothProtocol>;
  
  let usdcMint: PublicKey;
  let userTokenAccount: PublicKey;
  let vaultTokenAccount: PublicKey;
  let traderVaultPda: PublicKey;
  let userBalancePda: PublicKey;
  let marketPda: PublicKey;
  let positionPda: PublicKey;

  const user = provider.wallet;
  const governor = Keypair.generate();

  before(async () => {
    // Airdrop SOL to governor
    const sig = await provider.connection.requestAirdrop(
      governor.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);

    // Create USDC mint (6 decimals like real USDC)
    usdcMint = await createMint(
      provider.connection,
      user.payer,
      user.publicKey,
      null,
      6
    );

    // Create user token account
    userTokenAccount = await createAccount(
      provider.connection,
      user.payer,
      usdcMint,
      user.publicKey
    );

    // Mint 1000 USDC to user
    await mintTo(
      provider.connection,
      user.payer,
      usdcMint,
      userTokenAccount,
      user.publicKey,
      1000_000_000 // 1000 USDC (6 decimals)
    );

    // Derive PDAs
    [traderVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("trader_vault")],
      program.programId
    );

    [userBalancePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_balance"), user.publicKey.toBuffer()],
      program.programId
    );

    const marketId = new anchor.BN(1);
    [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), marketId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    [positionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("position"),
        user.publicKey.toBuffer(),
        marketPda.toBuffer(),
      ],
      program.programId
    );

    // Create vault token account (PDA owned)
    vaultTokenAccount = await createAccount(
      provider.connection,
      user.payer,
      usdcMint,
      traderVaultPda,
      undefined
    );
  });

  it("Initializes trader vault", async () => {
    await program.methods
      .initializeTraderVault()
      .accounts({
        authority: user.publicKey,
        traderVault: traderVaultPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const vault = await program.account.traderVault.fetch(traderVaultPda);
    assert.equal(vault.authority.toString(), user.publicKey.toString());
    assert.equal(vault.totalDeposits.toNumber(), 0);
  });

  it("Initializes user balance", async () => {
    await program.methods
      .initializeUserBalance()
      .accounts({
        user: user.publicKey,
        userBalance: userBalancePda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const balance = await program.account.userBalance.fetch(userBalancePda);
    assert.equal(balance.owner.toString(), user.publicKey.toString());
    assert.equal(balance.freeBalance.toNumber(), 0);
    assert.equal(balance.lockedBalance.toNumber(), 0);
  });

  it("Deposits USDC to trader vault", async () => {
    const depositAmount = new anchor.BN(100_000_000); // 100 USDC

    await program.methods
      .deposit(depositAmount)
      .accounts({
        user: user.publicKey,
        traderVault: traderVaultPda,
        userBalance: userBalancePda,
        userTokenAccount: userTokenAccount,
        vaultTokenAccount: vaultTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const balance = await program.account.userBalance.fetch(userBalancePda);
    assert.equal(balance.freeBalance.toNumber(), depositAmount.toNumber());

    const vaultAccount = await getAccount(provider.connection, vaultTokenAccount);
    assert.equal(vaultAccount.amount.toString(), depositAmount.toString());
  });

  it("Creates a market", async () => {
    const marketId = new anchor.BN(1);
    const bParam = new anchor.BN(1000); // b = 1000
    const feeBps = 100; // 1% fee

    await program.methods
      .createMarket(marketId, bParam, feeBps)
      .accounts({
        governor: governor.publicKey,
        market: marketPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([governor])
      .rpc();

    const market = await program.account.market.fetch(marketPda);
    assert.equal(market.marketId.toNumber(), marketId.toNumber());
    assert.equal(market.bParam.toNumber(), bParam.toNumber());
    assert.equal(market.feeBps, feeBps);
    assert.equal(market.isLive, true);
    assert.equal(market.isSettled, false);
    
    // Initial quantities should be b * 1e6 (scaled)
    const expectedQ = bParam.toNumber() * 1_000_000;
    assert.equal(market.qYes.toNumber(), expectedQ);
    assert.equal(market.qNo.toNumber(), expectedQ);
  });

  it("Initializes user position", async () => {
    await program.methods
      .initializePosition()
      .accounts({
        trader: user.publicKey,
        market: marketPda,
        userPosition: positionPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const position = await program.account.userPosition.fetch(positionPda);
    assert.equal(position.owner.toString(), user.publicKey.toString());
    assert.equal(position.market.toString(), marketPda.toString());
    assert.equal(position.yesBalance.toNumber(), 0);
    assert.equal(position.noBalance.toNumber(), 0);
  });

  it("Executes a buy trade", async () => {
    const deltaShares = new anchor.BN(100); // Buy 100 YES shares
    const maxCost = new anchor.BN(10_000_000); // Max 10 USDC

    const marketBefore = await program.account.market.fetch(marketPda);
    const balanceBefore = await program.account.userBalance.fetch(userBalancePda);

    await program.methods
      .trade(0, deltaShares, maxCost) // outcome=0 (YES)
      .accounts({
        trader: user.publicKey,
        market: marketPda,
        userPosition: positionPda,
        userBalance: userBalancePda,
      })
      .rpc();

    const marketAfter = await program.account.market.fetch(marketPda);
    const balanceAfter = await program.account.userBalance.fetch(userBalancePda);
    const position = await program.account.userPosition.fetch(positionPda);

    // Verify position updated
    assert.equal(position.yesBalance.toNumber(), deltaShares.toNumber());

    // Verify market quantities updated
    assert.equal(
      marketAfter.qYes.toNumber(),
      marketBefore.qYes.toNumber() + deltaShares.toNumber()
    );

    // Verify cost was deducted
    assert.isTrue(balanceAfter.freeBalance.lt(balanceBefore.freeBalance));
    
    console.log("Cost of buying 100 YES shares:", 
      balanceBefore.freeBalance.sub(balanceAfter.freeBalance).toNumber() / 1e6,
      "USDC"
    );
  });

  it("Withdraws USDC from trader vault", async () => {
    const withdrawAmount = new anchor.BN(10_000_000); // 10 USDC

    const balanceBefore = await program.account.userBalance.fetch(userBalancePda);
    const userTokenBefore = await getAccount(provider.connection, userTokenAccount);

    await program.methods
      .withdraw(withdrawAmount)
      .accounts({
        user: user.publicKey,
        traderVault: traderVaultPda,
        userBalance: userBalancePda,
        userTokenAccount: userTokenAccount,
        vaultTokenAccount: vaultTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const balanceAfter = await program.account.userBalance.fetch(userBalancePda);
    const userTokenAfter = await getAccount(provider.connection, userTokenAccount);

    assert.equal(
      balanceAfter.freeBalance.toNumber(),
      balanceBefore.freeBalance.sub(withdrawAmount).toNumber()
    );

    assert.equal(
      userTokenAfter.amount.toString(),
      (BigInt(userTokenBefore.amount.toString()) + BigInt(withdrawAmount.toString())).toString()
    );
  });

  it("Settles market", async () => {
    const winningOutcome = 0; // YES wins

    await program.methods
      .settleMarket(winningOutcome)
      .accounts({
        governor: governor.publicKey,
        market: marketPda,
      })
      .signers([governor])
      .rpc();

    const market = await program.account.market.fetch(marketPda);
    assert.equal(market.isLive, false);
    assert.equal(market.isSettled, true);
    assert.equal(market.winningOutcome, winningOutcome);
  });
});
