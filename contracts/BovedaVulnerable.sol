// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ADVERTENCIA: Este contrato es vulnerable a reentrancy intencionalmente.
// Solo para fines educativos. No desplegar en Mainnet.
contract BovedaVulnerable {
    mapping(address => uint256) public saldos;

    function depositar() external payable {
        saldos[msg.sender] += msg.value;
    }

    // VULNERABLE: transfiere antes de actualizar el estado
    function retirar() external {
        uint256 monto = saldos[msg.sender];
        require(monto > 0, "Sin saldo");

        // INTERACTIONS primero — ERROR CRITICO
        (bool exito, ) = msg.sender.call{value: monto}("");
        require(exito, "Fallo");

        // EFFECTS despues — demasiado tarde
        saldos[msg.sender] = 0;
    }
}
