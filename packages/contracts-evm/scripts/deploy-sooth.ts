import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const collateral = process.env.COLLATERAL_ADDRESS || ethers.ZeroAddress;
  const guardian = deployer.address;

  const Vault = await ethers.getContractFactory("SoothVault");
  const vault = await Vault.deploy();
  await vault.waitForDeployment();
  await vault.initialize(collateral);
  console.log("SoothVault:", await vault.getAddress());

  const AdjMgr = await ethers.getContractFactory("SoothAdjudicatorManager");
  const adjMgr = await AdjMgr.deploy();
  await adjMgr.waitForDeployment();
  await adjMgr.initialize(guardian);
  console.log("SoothAdjudicatorManager:", await adjMgr.getAddress());

  const Verifier = await ethers.getContractFactory("SoothZKVerifierStub");
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  console.log("SoothZKVerifierStub:", await verifier.getAddress());

  const Settlement = await ethers.getContractFactory("SoothSettlementMerkle");
  const settlement = await Settlement.deploy();
  await settlement.waitForDeployment();
  await settlement.initialize(await vault.getAddress(), await verifier.getAddress());
  console.log("SoothSettlementMerkle:", await settlement.getAddress());

  const Factory = await ethers.getContractFactory("SoothMarketFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();
  await factory.initialize(await vault.getAddress(), await adjMgr.getAddress());
  console.log("SoothMarketFactory:", await factory.getAddress());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
