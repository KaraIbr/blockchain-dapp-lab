const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const saldo = await ethers.provider.getBalance(deployer.address);
  console.log("Direccion del deployer:", deployer.address);
  console.log("Saldo en Sepolia:", ethers.formatEther(saldo), "ETH");
}

main().catch(console.error);
