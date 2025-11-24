import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const collateral = "0x0000000000000000000000000000000000000000"; // TODO: set collateral token

  const Vault = await ethers.getContractFactory("SoothVault");
  const vault = await Vault.deploy();
  await vault.deployed();
  await vault.initialize(collateral);
  console.log("SoothVault:", vault.address);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
