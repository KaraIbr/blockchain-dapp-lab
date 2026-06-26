const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Desplegando con la cuenta:", deployer.address);
  
  const saldoAntes = await ethers.provider.getBalance(deployer.address);
  console.log("Saldo antes del despliegue:", ethers.formatEther(saldoAntes), "ETH");

  console.log("\nDesplegando BovedaSegura...");
  const BovedaSegura = await ethers.getContractFactory("BovedaSegura");
  const boveda = await BovedaSegura.deploy();
  await boveda.waitForDeployment();

  const direccionContrato = await boveda.getAddress();
  console.log("Contrato desplegado en:", direccionContrato);

  const saldoDespues = await ethers.provider.getBalance(deployer.address);
  const costoDespliegue = saldoAntes - saldoDespues;
  console.log("\nCosto del despliegue:", ethers.formatEther(costoDespliegue), "ETH");
  console.log("Verifica en: https://sepolia.etherscan.io/address/" + direccionContrato);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
