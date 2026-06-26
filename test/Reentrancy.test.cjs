const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Demostracion de Reentrancy Attack", function () {
  it("Debe demostrar que BovedaVulnerable es explotable", async function () {
    const [victima, atacante] = await ethers.getSigners();

    // Despliega la boveda vulnerable
    const BovedaVulnerable = await ethers.getContractFactory("BovedaVulnerable");
    const boveda = await BovedaVulnerable.deploy();
    await boveda.waitForDeployment();

    // La victima deposita 5 ETH
    await boveda.connect(victima).depositar({ value: ethers.parseEther("5.0") });
    console.log("Balance boveda (victima deposito):",
      ethers.formatEther(await ethers.provider.getBalance(await boveda.getAddress())), "ETH");

    // Despliega el contrato atacante
    const Atacante = await ethers.getContractFactory("ContratoAtacante");
    const contratoAtacante = await Atacante.deploy(await boveda.getAddress());
    await contratoAtacante.waitForDeployment();

    // El atacante deposita solo 1 ETH y luego drena la boveda
    await contratoAtacante.connect(atacante).atacar({ value: ethers.parseEther("1.0") });

    const balanceFinal = await ethers.provider.getBalance(await boveda.getAddress());
    console.log("Balance boveda (despues del ataque):", ethers.formatEther(balanceFinal), "ETH");

    // La boveda deberia estar drenada
    expect(balanceFinal).to.equal(0n);
  });

  it("Debe demostrar que BovedaSegura NO es explotable", async function () {
    const [victima] = await ethers.getSigners();

    const BovedaSegura = await ethers.getContractFactory("BovedaSegura");
    const boveda = await BovedaSegura.deploy();
    await boveda.waitForDeployment();

    await boveda.connect(victima).depositar({ value: ethers.parseEther("5.0") });

    const Atacante = await ethers.getContractFactory("ContratoAtacante");
    const contratoAtacante = await Atacante.deploy(await boveda.getAddress());
    await contratoAtacante.waitForDeployment();

    // El ataque debe fallar contra la version segura
    await expect(
      contratoAtacante.atacar({ value: ethers.parseEther("1.0") })
    ).to.be.reverted;

    console.log("Ataque bloqueado por el modificador sinReentrada");
  });
});
