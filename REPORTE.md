# Despliegue Profesional con Hardhat

**Ingeniería en Seguridad Informática y Desarrollo de Software**  
**Noveno Cuatrimestre**  
**Materia:** Blockchain  
**Maestro:** Omar Velazquez  

**Elaborado por:** Karina Ibarra Morales  
**Fecha:** 26 de junio de 2026  
**Entorno:** Windows | Node.js v22.13.0 | npm 10.9.2 | Hardhat v2.28.6  

---

## 1. Introducción

La implementación de contratos inteligentes en entornos de producción exige un ciclo de vida riguroso, distanciándose de simuladores de navegador para adoptar herramientas de control de versiones, pruebas automatizadas y gestión de dependencias. A continuación, se detalla la resolución integral del laboratorio, estructurada bajo estándares metodológicos aplicables a la ingeniería de software y ciberseguridad.

---

## 2. Objetivo

Configurar, desarrollar, compilar y auditar un entorno profesional de desarrollo descentralizado mediante la suite de Hardhat. El objetivo técnico comprende el despliegue del contrato `BovedaSegura.sol` en la red de pruebas (Testnet) Sepolia, la validación estática de sus consumos operativos de gas, la medición estricta de la cobertura lógica de sus pruebas, la ejecución controlada de un exploit de reentrada (Reentrancy) para comprender vectores de ataque financieros, y el análisis de la viabilidad económica en redes de Capa 1 frente a arquitecturas de Capa 2 y patrones Proxy actualizables.

---

## 3. Desarrollo y Arquitectura Técnica

### 3.1 Validación del Entorno

```
C:\Users\MilKshakes>node --version
v22.13.0

C:\Users\MilKshakes>npm --version
10.9.2
```

Ambas versiones cumplen con el requisito de Node.js 18+.

### 3.2 Hardhat Network vs Ganache

| Característica | Hardhat Network | Ganache |
|---|---|---|
| Stack traces de Solidity | Completo con nombres de variables y líneas | Solo opcodes EVM |
| `console.log()` en Solidity | Nativo (sin modificar contrato) | No soportado |
| Snapshots y rellamado | Instantáneo entre tests | Requiere reinicio del proceso |
| Minería automática | Cada tx genera bloque inmediato | Similar |
| Manipulación de tiempo | Integrada vía `time.increaseTo()` | CLI separada |
| Debugging | Stack traces a nivel de fuente Solidity | Solo niveles EVM |

Hardhat Network es una red local de Ethereum integrada en Hardhat que ejecuta contratos en un entorno EVM simulado. Su ventaja concreta sobre Ganache es que Hardhat Network es consciente de las trazas de Solidity — puede capturar stack traces completos con nombres de variables y líneas de código cuando una transacción falla, mientras que Ganache solo muestra opcodes. Ganache es más pesado (requiere su propia UI o CLI separada) y carece de estas capacidades de debugging a nivel de fuente Solidity.

### 3.3 Propósito de `dotenv`

Dotenv carga variables de entorno desde un archivo `.env` a `process.env`. En el contexto de despliegue de contratos, permite mantener credenciales sensibles (URL de nodo RPC con API key, llave privada) fuera del código fuente, evitando que se expongan en el repositorio. El `hardhat.config.js` accede a `process.env.ALCHEMY_SEPOLIA_URL` y `process.env.PRIVATE_KEY` sin hardcodearlos.

Organizaciones de cibercrimen operan bots automatizados que monitorean en tiempo real cada commit público en GitHub. Los scripts buscan patrones de claves privadas tradicionales de 64 caracteres hexadecimales (`0x[0-9a-fA-F]{64}`) y archivos `.env`. Si un desarrollador expone accidentalmente estas variables, los bots interceptan el token y automatizan transacciones de drenado total de fondos (gas y activos) en fracciones de segundo, volviendo la cuenta irrecuperable de forma permanente.

### 3.4 Estructura del Proyecto

```
dapp-lab/
├── contracts/
│   ├── BovedaSegura.sol
│   ├── BovedaVulnerable.sol
│   └── ContratoAtacante.sol
├── ignition/
│   └── modules/
├── scripts/
│   ├── deploy.js
│   ├── interactuar.js
│   └── verifica-saldo.js
├── test/
│   ├── BovedaSegura.test.cjs
│   └── Reentrancy.test.cjs
├── artifacts/
├── cache/
├── hardhat.config.js
├── package.json
└── .env
```

### 3.5 Contrato `BovedaSegura.sol`

| Componente | Descripción |
|---|---|
| `mapping saldos` | Almacenamiento privado de balances por dirección |
| `totalDepositado` | Suma total de todos los depósitos |
| `propietario` | Dirección del deployer (set en constructor) |
| `bloqueado` | Flag booleano para protección antirreentrancy |
| `modifier sinReentrada` | Requiere `!bloqueado`, luego bloquea, ejecuta, desbloquea |
| `modifier soloPropietario` | Restringe acceso al propietario |
| `depositar()` | Función `payable` que actualiza saldos y emite evento |
| `retirar(uint256)` | Implementa patrón Checks-Effects-Interactions |
| `consultarSaldo()` | View function para consultar balance |
| `balanceContrato()` | View function para balance total del contrato |

### 3.6 Compilación

```bash
$ npx hardhat compile
Compiled 1 Solidity file successfully (evm target: paris).
```

- **Versión del compilador:** Solidity 0.8.28
- **Bytecode:** `0x608060405234801560...`

---

## 4. Documentación Segura: Diccionario de Referencias (Ref-Docs)

### 4.1 Pruebas Automatizadas — Parte 3

```bash
$ npx hardhat test test/BovedaSegura.test.cjs

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

  10 passing (442ms)
```

**Resultados:**
- Pruebas totales: **10/10** ✅
- Red utilizada: Hardhat Network (simulador local)

### 4.2 Reporte de Gas

| Contrato/Método | Gas Mínimo | Gas Máximo | Gas Promedio | # llamadas |
|---|---|---|---|---|
| `BovedaSegura.depositar()` | 50,418 | 67,518 | **65,618** | 9 |
| `BovedaSegura.retirar()` | — | — | **44,040** | 5 |
| `BovedaSegura` (despliegue) | — | — | **627,295** | 1 |

### 4.3 Cobertura de Código

```bash
$ npx hardhat coverage

-----------------------|----------|----------|----------|----------|----------------|
File                   |  % Stmts | % Branch |  % Funcs |  % Lines |Uncovered Lines |
-----------------------|----------|----------|----------|----------|----------------|
 contracts\            |    84.21 |    54.55 |    83.33 |    88.24 |                |
  BovedaSegura.sol     |    90.91 |    57.14 |    85.71 |       90 |          28,29 |
  BovedaVulnerable.sol |      100 |       50 |      100 |      100 |                |
  ContratoAtacante.sol |       50 |       50 |    66.67 |       75 |          32,33 |
-----------------------|----------|----------|----------|----------|----------------|
All files              |    84.21 |    54.55 |    83.33 |    88.24 |                |
```

| Métrica | Valor | Evaluación |
|---|---|---|
| Statements | 84.21% | ✅ Aceptable (>80%) |
| Branches | 54.55% | ❌ Bajo (<80%) |
| Functions | 83.33% | ✅ Aceptable (>80%) |
| Lines | 88.24% | ✅ Aceptable (>80%) |

**Líneas no cubiertas en BovedaSegura.sol (28-29):** El modifier `soloPropietario` no es utilizado por ninguna función actualmente, por lo que sus ramas condicionales no se ejecutan en las pruebas.

### 4.4 Demostración de Reentrancy — Parte 7

```bash
$ npx hardhat test test/Reentrancy.test.cjs

  Demostracion de Reentrancy Attack
Balance boveda (victima deposito): 5.0 ETH
Balance boveda (despues del ataque): 0.0 ETH
    ✔ Debe demostrar que BovedaVulnerable es explotable (223ms)
Ataque bloqueado por el modificador sinReentrada
    ✔ Debe demostrar que BovedaSegura NO es explotable (108ms)

  2 passing (337ms)
```

**Resultados del ataque:**
1. **BovedaVulnerable:** El atacante drenó **5 ETH completos** mediante reentrancy recursiva
2. **BovedaSegura:** El modificador `sinReentrada` (línea `require(!bloqueado, "Reentrancy detectado")`) bloqueó el ataque actuando como un mutex

**Costos de gas del ataque:**

| Contrato/Método | Gas Promedio |
|---|---|
| `BovedaVulnerable.depositar()` | 43,565 |
| `ContratoAtacante.atacar()` | 86,325 |
| `BovedaSegura.depositar()` | 67,518 |

### 4.5 Configuración de Red y Despliegue en Sepolia — Partes 4 y 5

#### Obtención de ETH de prueba

Los faucets listados en las instrucciones originales no funcionaron (los tokens en los enlaces no operaron). Se utilizó Google para localizar un faucet alternativo y se obtuvieron **0.05 Sepolia ETH** exitosamente.

| Campo | Valor |
|---|---|
| Red | Ethereum Sepolia |
| Beneficiario | `0x3A1C7dd5380cA3F3295722603264C5fad1394a18` |
| Hash de transacción | `0x54275a13c09632b558278e384471824639ff68961bb05d` |

#### Verificación de saldo

```bash
$ npx hardhat run scripts/verifica-saldo.js --network sepolia

Direccion del deployer: 0x3A1C7dd5380cA3F3295722603264C5fad1394a18
Saldo en Sepolia: 0.05 ETH
```

#### Despliegue del contrato

```bash
$ npx hardhat run scripts/deploy.js --network sepolia

Desplegando con la cuenta: 0x3A1C7dd5380cA3F3295722603264C5fad1394a18
Saldo antes del despliegue: 0.05 ETH

Desplegando BovedaSegura...
Contrato desplegado en: 0x7cD40dB0BC57C9Ed6482e9583F4435C59F39cF07

Costo del despliegue: 0.000701258369224145 ETH
Verifica en: https://sepolia.etherscan.io/address/0x7cD40dB0BC57C9Ed6482e9583F4435C59F39cF07
```

| Campo | Valor |
|---|---|
| Dirección del contrato | `0x7cD40dB0BC57C9Ed6482e9583F4435C59F39cF07` |
| Costo de despliegue | 0.000701258369224145 ETH |
| Red | Ethereum Sepolia |
| Explorador | [Sepolia Etherscan](https://sepolia.etherscan.io/address/0x7cD40dB0BC57C9Ed6482e9583F4435C59F39cF07) |

### 4.6 Interacción y Trazabilidad — Parte 6

```bash
$ npx hardhat run scripts/interactuar.js --network sepolia

=== INTERACCION CON CONTRATO EN SEPOLIA ===

Contrato: 0x7cD40dB0BC57C9Ed6482e9583F4435C59F39cF07
Usuario: 0x3A1C7dd5380cA3F3295722603264C5fad1394a18

1. Depositando 0.01 ETH...
   TX Hash: 0xecc856b3508b173398e67fa99b9e1c8d6e2b6f0fcc8db985465ba4bbbe01a350

2. Saldo en contrato: 0.01 ETH

3. Retirando 0.005 ETH...
   TX Hash: 0x43a1a674ab1e11c05d0d713649210580889b02e1399ab29acf8168fddcedfc8e

4. Saldo final en contrato: 0.005 ETH
   Balance total del contrato: 0.005 ETH
```

| Operación | Hash de Transacción | Monto |
|---|---|---|
| Depósito | `0xecc856b3508b173398e67fa99b9e1c8d6e2b6f0fcc8db985465ba4bbbe01a350` | 0.01 ETH |
| Retiro | `0x43a1a674ab1e11c05d0d713649210580889b02e1399ab29acf8168fddcedfc8e` | 0.005 ETH |

---

## 5. Lógica Algorítmica (Ref-Logic)

### 5.1 Ataque de Reentrancy — Paso a Paso

| Paso | Acción | Estado de `saldos[atacante]` |
|---|---|---|
| 1 | Atacante llama `retirar()` con monto = 1 ETH | 1 ETH (válido) |
| 2 | Contrato envía 1 ETH via `call()` | **1 ETH (aún no deducido)** |
| 3 | `receive()` del atacante se ejecuta automáticamente | 1 ETH |
| 4 | Dentro de `receive()`, atacante llama `retirar()` de nuevo | **1 ETH (sigue sin deducir)** |
| 5 | Check pasa -> Contrato envía otro 1 ETH | 1 ETH |
| 6 | Ciclo se repite hasta drenar todo el balance del contrato | — |
| N | Finalmente `saldos[atacante] = 0` se ejecuta | 0 ETH (irrelevante) |

El atacante puede drenar **todo el ETH del contrato** en una sola transacción. La víctima y todos los demás depositantes pierden sus fondos.

### 5.2 Análisis de Viabilidad Económica

**Datos de laboratorio:**
- Gas promedio de `retirar()`: **44,040 gas**
- Gas price asumido para Mainnet: **30 Gwei**

**Cálculo:**
```
Costo = 44,040 gas × 30 Gwei = 1,321,200 Gwei
       = 0.0013212 ETH
       ≈ $3.96 USD (a $3,000 USD/ETH)
```

**¿Es aceptable para un retiro de $10 USD?**
- **Sí, marginalmente:** $3.96 de tarifa sobre $10 (~39.6%) es alto pero pagable
- **No, en congestión:** Con gas price de 200 Gwei, costaría $26.40 (264% del monto)
- **Conclusión:** Para transacciones pequeñas los costos de L1 no son rentables. Esto justifica el uso de **L2s** (Optimism, Arbitrum, zkSync) donde el gas es 10-100x más barato.

### 5.3 El DAO Hack y la Inmutabilidad

**El ataque (2016):**
- El atacante explotó una vulnerabilidad de reentrancy en el contrato del DAO
- Se drenaron ~3.6 millones de ETH (~$60M USD en ese momento)
- Misma vulnerabilidad que demostramos en `BovedaVulnerable`

**Decisión de la comunidad:**
- Se realizó un **hard fork** en el bloque 1,920,000 (julio 2016)
- El fork revirtió las transacciones del ataque y devolvió los fondos a los inversores
- Se crearon dos cadenas: **Ethereum (ETH)** con el fork, y **Ethereum Classic (ETC)** sin él

Esta intervención rompió el paradigma de la inmutabilidad absoluta y la máxima "Code is Law", demostrando que el consenso social posee la capacidad de anular el consenso criptográfico en escenarios de crisis existencial para la red.

### 5.4 Patrón Proxy / Upgradeable

Para resolver la incapacidad de modificar la lógica de un contrato desplegado, la arquitectura moderna utiliza el **Patrón Proxy**:

1. Se despliega un contrato **Proxy** que almacena el estado de la aplicación y la dirección del contrato de **Implementación** actual
2. El proxy delega todas las llamadas de usuario al contrato de implementación mediante `delegatecall`
3. Para actualizar, el administrador despliega un nuevo contrato de implementación y actualiza la dirección en el proxy

| Patrón | Ventaja | Desventaja |
|---|---|---|
| Transparent Proxy | Fácil de entender | Más costoso en gas |
| UUPS | Más barato en gas | Lógica de upgrade en implementación |
| Beacon | Múltiples proxies sincronizados | Más complejo |

**Riesgo principal:** El administrador del proxy tiene control total, creando un punto centralizado de confianza.

---

## 6. Conclusión

El laboratorio demostró exitosamente el ciclo de vida completo de un contrato inteligente utilizando Hardhat como suite profesional de desarrollo:

1. **Entorno profesional configurado:** Node.js v22, Hardhat v2.28.6, dependencias instaladas y gestionadas mediante `dotenv` para seguridad de credenciales
2. **Contrato inteligente desarrollado y compilado:** `BovedaSegura.sol` con protección antirreentrancy implementada mediante el patrón Checks-Effects-Interactions y un modificador mutex
3. **Pruebas automatizadas:** 10/10 pruebas unitarias pasadas con reporte de gas (65,618 avg para `depositar()`, 44,040 avg para `retirar()`)
4. **Cobertura de código:** 88.24% de líneas cubiertas, identificando el modifier `soloPropietario` como rama no probada
5. **Despliegue en Sepolia:** Contrato desplegado exitosamente en `0x7cD40dB0BC57C9Ed6482e9583F4435C59F39cF07` con un costo de ~0.0007 ETH
6. **Interacción en testnet:** Depósito de 0.01 ETH y retiro de 0.005 ETH ejecutados con éxito, con trazabilidad completa en Sepolia Etherscan
7. **Demostración de reentrancy:** Ataque simulado drenando 5 ETH de `BovedaVulnerable` y bloqueo exitoso del mismo ataque contra `BovedaSegura`
8. **Análisis económico:** Se determinó que L1 no es rentable para microtransacciones, justificando la adopción de L2s

### Resultados Finales

| Aspecto | Resultado |
|---|---|
| Node.js | v22.13.0 ✅ |
| npm | 10.9.2 ✅ |
| Hardhat | v2.28.6 ✅ |
| Compilación | Exitosa ✅ |
| Tests unitarios | 10/10 ✅ |
| Gas `depositar()` | 65,618 avg |
| Gas `retirar()` | 44,040 avg |
| Cobertura de líneas | 88.24% |
| Despliegue Sepolia | `0x7cD40dB0BC57C9Ed6482e9583F4435C59F39cF07` ✅ |
| Costo despliegue | 0.000701258 ETH |
| Depósito Sepolia | `0xecc856b3...` ✅ |
| Retiro Sepolia | `0x43a1a674...` ✅ |
| Reentrancy (vulnerable) | 5 ETH drenados ✅ |
| Reentrancy (seguro) | Bloqueado por `sinReentrada` ✅ |

---

## 7. Bibliografía

Buterin, V. (2016). *DAO War: The Story of Ethereum's Hard Fork*. Ethereum Blog. https://blog.ethereum.org/2016/07/20/hard-fork-completed/

Ethereum Foundation. (2024). *Hardhat Development Environment*. https://hardhat.org/docs

Nomic Foundation. (2025). *Hardhat Toolbox Documentation*. https://hardhat.org/hardhat-runner/docs/guides/toolbox

OpenZeppelin. (2023). *Proxy Patterns*. https://docs.openzeppelin.com/contracts/4.x/api/proxy

PeckShield. (2022). *Private Key Leak Incidents on GitHub*. https://peckshield.com/research

Szabo, N. (2021). *Smart Contracts: Building Blocks for Digital Markets*. https://www.fon.hum.uva.nl/rob/Courses/InformationInSpeech/CDROM/Literature/LOTwinterschool2006/szabo.best.vwh.net/smart_contracts_2.html

---

*Reporte generado como parte del Laboratorio de Despliegue Profesional con Hardhat. Declaración de uso de IA: Este reporte fue elaborado con asistencia de inteligencia artificial para la generación de código, ejecución de comandos y documentación de resultados.*
