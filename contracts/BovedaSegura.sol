// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BovedaSegura
 * @notice Contrato de depósito/retiro con protección contra reentrancy
 * @dev Implementa el patrón Checks-Effects-Interactions
 */
contract BovedaSegura {

    mapping(address => uint256) private saldos;
    uint256 public totalDepositado;
    address public propietario;
    bool private bloqueado;

    event Deposito(address indexed cuenta, uint256 monto);
    event Retiro(address indexed cuenta, uint256 monto);
    event EmergenciaActivada(address por);

    modifier sinReentrada() {
        require(!bloqueado, "Reentrancy detectado");
        bloqueado = true;
        _;
        bloqueado = false;
    }

    modifier soloPropietario() {
        require(msg.sender == propietario, "No autorizado");
        _;
    }

    constructor() {
        propietario = msg.sender;
    }

    function depositar() external payable {
        require(msg.value > 0, "Monto requerido");
        saldos[msg.sender] += msg.value;
        totalDepositado += msg.value;
        emit Deposito(msg.sender, msg.value);
    }

    function retirar(uint256 monto) external sinReentrada {
        // CHECKS: verifica antes de modificar estado
        require(monto > 0, "Monto invalido");
        require(saldos[msg.sender] >= monto, "Saldo insuficiente");

        // EFFECTS: modifica el estado antes de transferir
        saldos[msg.sender] -= monto;
        totalDepositado -= monto;

        // INTERACTIONS: transfiere después de actualizar estado
        (bool exito, ) = msg.sender.call{value: monto}("");
        require(exito, "Transferencia fallida");

        emit Retiro(msg.sender, monto);
    }

    function consultarSaldo(address cuenta) external view returns (uint256) {
        return saldos[cuenta];
    }

    function balanceContrato() external view returns (uint256) {
        return address(this).balance;
    }
}
