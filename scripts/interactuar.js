const { ethers } = require("hardhat");

const DIRECCION_CONTRATO = "0xTU_DIRECCION_AQUI";

async function main() {
  const [usuario] = await ethers.getSigners();
  const boveda = await ethers.getContractAt("BovedaSegura", DIRECCION_CONTRATO);

  console.log("=== INTERACCION CON CONTRATO EN SEPOLIA ===\n");
  console.log("Contrato:", DIRECCION_CONTRATO);
  console.log("Usuario:", usuario.address);

  // Deposito
  const montoDeposito = ethers.parseEther("0.01");
  console.log("\n1. Depositando", ethers.formatEther(montoDeposito), "ETH...");
  const txDeposito = await boveda.depositar({ value: montoDeposito });
  await txDeposito.wait();
  console.log("   TX Hash:", txDeposito.hash);

  // Consulta saldo
  const saldo = await boveda.consultarSaldo(usuario.address);
  console.log("\n2. Saldo en contrato:", ethers.formatEther(saldo), "ETH");

  // Retiro parcial
  const montoRetiro = ethers.parseEther("0.005");
  console.log("\n3. Retirando", ethers.formatEther(montoRetiro), "ETH...");
  const txRetiro = await boveda.retirar(montoRetiro);
  await txRetiro.wait();
  console.log("   TX Hash:", txRetiro.hash);

  // Saldo final
  const saldoFinal = await boveda.consultarSaldo(usuario.address);
  const balanceContrato = await boveda.balanceContrato();
  console.log("\n4. Saldo final en contrato:", ethers.formatEther(saldoFinal), "ETH");
  console.log("   Balance total del contrato:", ethers.formatEther(balanceContrato), "ETH");
  
  console.log("\n=== VERIFICA LAS TRANSACCIONES ===");
  console.log("https://sepolia.etherscan.io/address/" + DIRECCION_CONTRATO);
}

main().catch(console.error);
