const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BovedaSegura", function () {
  let boveda;
  let propietario, usuario1, usuario2;

  beforeEach(async function () {
    [propietario, usuario1, usuario2] = await ethers.getSigners();
    const BovedaSegura = await ethers.getContractFactory("BovedaSegura");
    boveda = await BovedaSegura.deploy();
    await boveda.waitForDeployment();
  });

  describe("Despliegue", function () {
    it("Debe asignar al deployer como propietario", async function () {
      expect(await boveda.propietario()).to.equal(propietario.address);
    });

    it("Debe iniciar con balance cero", async function () {
      expect(await boveda.balanceContrato()).to.equal(0n);
    });
  });

  describe("Depositos", function () {
    it("Debe registrar un deposito correctamente", async function () {
      const monto = ethers.parseEther("1.0");
      await boveda.connect(usuario1).depositar({ value: monto });

      expect(await boveda.consultarSaldo(usuario1.address)).to.equal(monto);
      expect(await boveda.totalDepositado()).to.equal(monto);
    });

    it("Debe emitir el evento Deposito", async function () {
      const monto = ethers.parseEther("0.5");
      await expect(boveda.connect(usuario1).depositar({ value: monto }))
        .to.emit(boveda, "Deposito")
        .withArgs(usuario1.address, monto);
    });

    it("Debe rechazar depositos de cero", async function () {
      await expect(
        boveda.connect(usuario1).depositar({ value: 0 })
      ).to.be.revertedWith("Monto requerido");
    });
  });

  describe("Retiros", function () {
    beforeEach(async function () {
      await boveda.connect(usuario1).depositar({
        value: ethers.parseEther("2.0"),
      });
    });

    it("Debe procesar un retiro valido", async function () {
      const monto = ethers.parseEther("1.0");
      const saldoAntes = await ethers.provider.getBalance(usuario1.address);

      const tx = await boveda.connect(usuario1).retirar(monto);
      const recibo = await tx.wait();
      const gasGastado = recibo.gasUsed * recibo.gasPrice;

      const saldoDespues = await ethers.provider.getBalance(usuario1.address);

      expect(saldoDespues).to.equal(saldoAntes + monto - gasGastado);
    });

    it("Debe rechazar retiro mayor al saldo", async function () {
      const montoExcesivo = ethers.parseEther("5.0");
      await expect(
        boveda.connect(usuario1).retirar(montoExcesivo)
      ).to.be.revertedWith("Saldo insuficiente");
    });

    it("Debe emitir el evento Retiro", async function () {
      const monto = ethers.parseEther("1.0");
      await expect(boveda.connect(usuario1).retirar(monto))
        .to.emit(boveda, "Retiro")
        .withArgs(usuario1.address, monto);
    });

    it("Debe actualizar totalDepositado tras el retiro", async function () {
      const depositoInicial = ethers.parseEther("2.0");
      const montoRetiro = ethers.parseEther("1.0");
      await boveda.connect(usuario1).retirar(montoRetiro);
      expect(await boveda.totalDepositado()).to.equal(
        depositoInicial - montoRetiro
      );
    });
  });

  describe("Multiples usuarios", function () {
    it("Debe mantener saldos independientes por usuario", async function () {
      await boveda.connect(usuario1).depositar({
        value: ethers.parseEther("1.0"),
      });
      await boveda.connect(usuario2).depositar({
        value: ethers.parseEther("3.0"),
      });

      expect(await boveda.consultarSaldo(usuario1.address)).to.equal(
        ethers.parseEther("1.0")
      );
      expect(await boveda.consultarSaldo(usuario2.address)).to.equal(
        ethers.parseEther("3.0")
      );
    });
  });
});
