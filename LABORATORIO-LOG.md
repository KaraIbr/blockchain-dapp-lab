# Laboratorio — Despliegue Profesional con Hardhat
**Materia:** Blockchain y Bases de Datos Distribuidas
**Carrera:** Ciberseguridad y Desarrollo de Software
**Tema:** Desarrollo en Solidity Avanzado — Herramientas de despliegue y ciclo de vida de una DApp

---

## Log de Progreso del Laboratorio

### Fecha de ejecución: 26 de junio de 2026

---

## 1. Verificación del Entorno

```bash
node --version  # v22.13.0
npm --version   # 10.9.2
```

Ambas versiones cumplen con el requisito de Node.js 18+.

---

## 2. Parte 1 — Configuración del Entorno Profesional

### 2.1 Inicialización del proyecto

- `npm init -y`: Proyecto inicializado
- `npm install --save-dev hardhat`: Hardhat v2.28.6 instalado
- `npx hardhat init`: Proyecto JavaScript creado con estructura:

```
dapp-lab/
├── contracts/       ← Contratos Solidity
├── ignition/        ← Módulos de despliegue
├── test/            ← Pruebas automatizadas
├── hardhat.config.js
└── package.json
```

### 2.2 Dependencias adicionales

- `@nomicfoundation/hardhat-toolbox` (v6.1.2): Ya incluido en el template
- `dotenv`: Instalado para gestionar variables de entorno

### 2.3 Investigación

#### Hardhat Network vs Ganache

Hardhat Network es un simulador local de Ethereum integrado en Hardhat que ofrece ventajas sobre Ganache:

| Característica | Hardhat Network | Ganache |
|---|---|---|
| Stack traces de Solidity | ✅ Completo con nombres de variables | ❌ Solo opcodes |
| `console.log()` en Solidity | ✅ Nativo | ❌ No soportado |
| Snapshots/rellamado | ✅ Instantáneo | ❌ Requiere reinicio |
| Minería automática | ✅ Cada tx genera bloque | ✅ Similar |
| Manipulación de tiempo | ✅ Integrada | ✅ CLI separada |

**Ventaja concreta:** Hardhat Network es consciencia de las trazas de Solidity, lo que permite debugging a nivel de código fuente sin herramientas externas.

#### Propósito de dotenv

`dotenv` carga variables de entorno desde un archivo `.env` a `process.env`, permitiendo mantener credenciales sensibles (API keys, llaves privadas) fuera del código fuente. En el contexto de despliegue, evita hardcodear `ALCHEMY_SEPOLIA_URL` y `PRIVATE_KEY` en `hardhat.config.js`.

---

## 3. Parte 2 — Contrato y Compilación

### 3.1 Contrato BovedaSegura.sol

Estructura del contrato:
- **Mapping**: `saldos` (privado) para almacenar balances por dirección
- **Variables**: `totalDepositado`, `propietario`, `bloqueado`
- **Eventos**: `Deposito`, `Retiro`, `EmergenciaActivada`
- **Modifiers**: `sinReentrada` (protección), `soloPropietario` (control de acceso)
- **Funciones**: `depositar()`, `retirar()`, `consultarSaldo()`, `balanceContrato()`

### 3.2 Compilación

**Resultado**: `Compiled 1 Solidity file successfully (evm target: paris).`

- **Versión del compilador**: 0.8.28
- **Archivos generados en `artifacts/contracts/BovedaSegura.sol/`**:
  - `BovedaSegura.dbg.json` (debug info)
  - `BovedaSegura.json` (ABI + bytecode)
- **Bytecode (primeros 20 caracteres)**: `0x608060405234801560`

### 3.3 Análisis: Checks-Effects-Interactions

Si el orden fuera Checks → Interactions → Effects:

```solidity
// CHECKS: pasa
require(saldos[msg.sender] >= monto);

// INTERACTIONS: envía ETH primero
(bool exito, ) = msg.sender.call{value: monto}("");  // ¡PELIGRO!

// EFFECTS: actualiza después
saldos[msg.sender] -= monto;  // Demasiado tarde
```

**Ataque posible**:
1. Atacante llama a `retirar()` con saldo válido
2. Contrato envía ETH → `receive()` del atacante se ejecuta
3. Dentro de `receive()`, atacante llama `retirar()` de nuevo
4. `saldos[msg.sender]` aún no se dedujo → check pasa otra vez
5. Contrato envía más ETH → ciclo se repite hasta drenar el contrato

---

## 4. Parte 3 — Pruebas Automatizadas

### 4.1 Resultados de tests

```
  BovedaSegura
    Despliegue
      ✔ Debe asignar al deployer como propietario
      ✔ Debe iniciar con balance cero
    Depositos
      ✔ Debe registrar un deposito correctamente
      ✔ Debe emitir el evento Deposito
      ✔ Debe rechazar depositos de cero
    Retiros
      ✔ Debe procesar un retiro valido
      ✔ Debe rechazar retiro mayor al saldo
      ✔ Debe emitir el evento Retiro
      ✔ Debe actualizar totalDepositado tras el retiro
    Multiples usuarios
      ✔ Debe mantener saldos independientes por usuario

  10 passing (2s)
```

- **Pruebas que pasaron**: 10/10
- **Red usada**: Hardhat Network (local, sin despliegue externo)
- **Tiempo total**: ~2s (incluyendo despliegues en beforeEach)

### 4.2 Reporte de Gas

| Método | Gas Min | Gas Max | Gas Avg | # calls |
|---|---|---|---|---|
| `depositar()` | 50,418 | 67,518 | 65,618 | 9 |
| `retirar()` | - | - | 44,040 | 5 |
| **Despliegue** | - | - | 627,295 | 1 |

### 4.3 Cobertura de Pruebas

| Métrica | Porcentaje | Estado |
|---|---|---|
| Statements | 90.91% | ✅ > 80% |
| Branches | 57.14% | ❌ < 80% |
| Functions | 85.71% | ✅ > 80% |
| Lines | 90% | ✅ > 80% |

**Líneas no cubiertas**: 28, 29 (modificador `soloPropietario`)

```solidity
modifier soloPropietario() {
    require(msg.sender == propietario, "No autorizado");  // Línea 28
    _;                                                     // Línea 29
}
```

**Importancia**: El modifier `soloPropietario` no se prueba en ningún test. Aunque no se usa actualmente, es una función de seguridad crítica. Si en el futuro se agrega una función restringida, una rama no probada podría ocultar bugs de autorización, permitiendo que usuarios no autorizados ejecuten funciones privilegiadas.

---

## 5. Parte 4 — Configuración de Despliegue (PENDIENTE - requiere credenciales)

### 5.1 Archivos creados

- `.env` → Pendiente de configuración
- `.gitignore` → Incluye `.env`, `node_modules`, `artifacts`, `cache`, `coverage`

### 5.2 ¿Por qué `.env` debe estar en `.gitignore`?

El archivo `.env` contiene la llave privada de una cuenta de Ethereum y la API key de Alchemy. Si se suben a un repositorio público:
- Bots automatizados escanean GitHub en busca de patrones `0x[0-9a-fA-F]{64}`
- La cuenta puede ser drenada en minutos

**Caso real**: En 2022, múltiples desarrolladores perdieron fondos cuando sus llaves privadas almacenadas en archivos de configuración de Hardhat fueron detectadas por bots en GitHub. PeckShield documentó este patrón recurrente en "Private Key Leak Incidents on GitHub".

### 5.3 Configuración de Hardhat

`hardhat.config.js` actualizado con configuración de red Sepolia (pendiente de credenciales).

---

## 6. Parte 5 — Despliegue en Sepolia (PENDIENTE - requiere credenciales)

Scripts creados:
- `scripts/verifica-saldo.js` ✓
- `scripts/deploy.js` ✓

---

## 7. Parte 6 — Interacción (PENDIENTE - requiere contrato desplegado)

- `scripts/interactuar.js` ✓ (Pendiente de dirección del contrato)

---

## 8. Parte 7 — Seguridad: Reentrancy

**(Ver resultados en siguiente sección)**

---

## 9. Parte 8 — Reflexión Final

### 9.1 Costo de retirar en Mainnet con 30 Gwei

De la Parte 3: `retirar()` consume ~44,040 gas en promedio.

```
Costo = 44,040 gas × 30 Gwei = 1,321,200 Gwei = 0.0013212 ETH
```

Con ETH a ~$3,000 USD: 0.0013212 × $3,000 = **$3.96 USD**

Para un retiro de $10 USD, una tarifa de ~$3.96 (~39.6%) es **alta pero manejable** en momentos de baja congestión. En períodos de alta demanda (200+ Gwei), costaría ~$26.40 USD (264% del monto), lo que no sería aceptable. Esto justifica el uso de L2s para transacciones pequeñas.

### 9.2 El DAO Hack y la inmutabilidad de Ethereum

**Decisión**: La comunidad realizó un hard fork en el bloque 1,920,000 para revertir las transacciones del ataque al DAO, devolviendo ~3.6M ETH a los inversores.

**Consecuencia permanente**: Se crearon dos cadenas:
- **Ethereum (ETH)**: Con el fork, fondos recuperados
- **Ethereum Classic (ETC)**: Sin el fork, "code is law"

**¿Contradice la inmutabilidad?** Sí. El principio de inmutabilidad ("code is law") se violó al modificar el estado histórico. Sin embargo, fue una decisión excepcional para proteger a inversores. Desde entonces no se ha repetido una intervención similar.

### 9.3 Patrón de actualización: Proxy/Upgradeable

**Proxy Pattern (EIP-1967)**: Permite actualizar la lógica de un contrato después de desplegado.

**Cómo funciona**:
1. Un contrato **Proxy** almacena el estado y delega llamadas via `delegatecall` a un contrato de **Implementación**
2. Para actualizar, se despliega una nueva implementación y se actualiza la dirección en el proxy
3. El estado permanece en el proxy; solo la lógica cambia

**Riesgo**: El administrador del proxy tiene poder absoluto, creando un punto de confianza centralizada.
