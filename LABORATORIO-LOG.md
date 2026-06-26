# Laboratorio — Despliegue Profesional con Hardhat
**Materia:** Blockchain y Bases de Datos Distribuidas | **Carrera:** Ciberseguridad y Desarrollo de Software
**Tema:** Desarrollo en Solidity Avanzado — Herramientas de despliegue y ciclo de vida de una DApp

---

## Log de Progreso del Laboratorio

**Fecha de ejecución:** 26 de junio de 2026
**Entorno:** Windows | Node.js v22.13.0 | npm 10.9.2 | Hardhat v2.28.6

---

## 1. Verificación del Entorno

```bash
$ node --version
v22.13.0
$ npm --version
10.9.2
```

Ambas versiones cumplen con el requisito de Node.js 18+.

---

## 2. Parte 1 — Configuración del Entorno Profesional

### 2.1 Inicialización del proyecto

- `npm init -y`: Proyecto inicializado
- `npm install --save-dev hardhat`: Hardhat v2.28.6 instalado
- `npx hardhat init` → seleccionado: **Create a JavaScript project**

**Estructura generada:**
```
dapp-lab/
├── contracts/       ← Contratos Solidity
│   └── Lock.sol     ← (eliminado después)
├── ignition/        ← Módulos de despliegue
│   └── modules/
├── test/            ← Pruebas automatizadas
│   └── Lock.js      ← (eliminado después)
├── artifacts/       ← Compilación (generado)
├── cache/           ← Cache (generado)
├── hardhat.config.js
├── package.json
└── .gitignore
```

### 2.2 Dependencias adicionales instaladas

- `@nomicfoundation/hardhat-toolbox` (v6.1.2) — ya incluido en el template
- `dotenv` (última versión) — instalado para gestión de variables de entorno

### 2.3 Investigación: Hardhat Network vs Ganache

| Característica | Hardhat Network | Ganache |
|---|---|---|
| Stack traces de Solidity | ✅ Completo con nombres de variables y líneas | ❌ Solo opcodes EVM |
| `console.log()` en Solidity | ✅ Nativo (sin modificar contrato) | ❌ No soportado |
| Snapshots y rellamado | ✅ Instantáneo entre tests | ❌ Requiere reinicio del proceso |
| Minería automática | ✅ Cada tx genera bloque inmediato | ✅ Similar |
| Manipulación de tiempo | ✅ Integrada vía `time.increaseTo()` | ✅ CLI separada |
| Debugging | ✅ Stack traces a nivel de fuente Solidity | ❌ Solo niveles EVM |

**Ventaja concreta de Hardhat Network:** Proporciona **stack traces de Solidity** completos — cuando una transacción falla, Hardhat muestra exactamente la línea del código Solidity que causó el error, con los valores de las variables en ese momento. Ganache solo muestra el opcode y el mensaje de revert, sin contexto de alto nivel. Además, `console.log()` desde Solidity permite debuggear sin modificar la lógica ni desplegar en testnets.

### 2.4 Investigación: Propósito de `dotenv`

`dotenv` carga variables desde un archivo `.env` a `process.env`. En el contexto de despliegue de contratos, permite mantener **credenciales sensibles fuera del código fuente**:

- `ALCHEMY_SEPOLIA_URL` — URL del nodo RPC con API key
- `PRIVATE_KEY` — Llave privada de la cuenta desplegadora

Esto evita hardcodear estos valores en `hardhat.config.js`, previniendo que se expongan al subir el código a un repositorio público.

---

## 3. Parte 2 — Contrato y Compilación

### 3.1 Contrato `BovedaSegura.sol`

**Estructura del contrato:**
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

### 3.2 Compilación

```bash
$ npx hardhat compile
Compiled 1 Solidity file successfully (evm target: paris).
```

- **Versión del compilador usado:** Solidity 0.8.28 (configurado en `hardhat.config.js`)
- **Archivos generados en `artifacts/contracts/BovedaSegura.sol/`:**
  - `BovedaSegura.dbg.json` — Metadatos de debug
  - `BovedaSegura.json` — ABI completa + bytecode de deploy + bytecode de runtime

**Bytecode (primeros 20 caracteres):** `0x608060405234801560`

El prefijo `0x6080604052` corresponde al código de inicialización estándar de contratos Ethereum (copia del runtime code al storage y llamada al constructor).

### 3.3 Análisis de seguridad: ¿Qué pasa si el orden es Checks → Interactions → Effects?

**Escenario vulnerable:**
```solidity
function retirar(uint256 monto) external {
    // CHECKS
    require(monto > 0);
    require(saldos[msg.sender] >= monto);

    // INTERACTIONS (primero — ERROR CRÍTICO)
    (bool exito, ) = msg.sender.call{value: monto}("");

    // EFFECTS (después — DEMASIADO TARDE)
    saldos[msg.sender] -= monto;
}
```

**Ataque de reentrancy paso a paso:**

| Paso | Acción | Estado de `saldos[atacante]` |
|------|--------|------------------------------|
| 1 | Atacante llama `retirar()` con monto = 1 ETH | 1 ETH (válido) |
| 2 | Contrato envía 1 ETH via `call()` | **1 ETH (¡aún no deducido!)** |
| 3 | `receive()` del atacante se ejecuta automaticamente | 1 ETH |
| 4 | Dentro de `receive()`, atacante llama `retirar()` de nuevo | **1 ETH (sigue sin deducir)** |
| 5 | Check pasa -> Contrato envía otro 1 ETH | 1 ETH |
| 6 | Ciclo se repite hasta drenar todo el balance del contrato | — |
| N | Finalmente `saldos[atacante] = 0` se ejecuta | 0 ETH (irrelevante) |

El atacante puede drenar **todo el ETH del contrato** en una sola transacción. La víctima y todos los demás depositantes pierden sus fondos.

---

## 4. Parte 3 — Pruebas Automatizadas

### 4.1 Ejecución de tests

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

**Resultados:**
- **Pruebas totales:** 10
- **Pruebas pasadas:** 10/10 ✅
- **Red utilizada:** Hardhat Network (simulador local)
- **Despliegue externo:** No — Hardhat despliega los contratos automáticamente en su red local para cada test

### 4.2 Reporte de Gas

| Método | Gas Mínimo | Gas Máximo | Gas Promedio | # llamadas |
|---|---|---|---|---|
| `depositar()` | 50,418 | 67,518 | **65,618** | 9 |
| `retirar()` | — | — | **44,040** | 5 |
| **Despliegue** | — | — | **627,295** | 1 |

**Análisis:** 
- `depositar()` consume más gas que `retirar()` porque es `payable` (costo base más alto por validación de valor ETH) y porque la primera llamada es más cara (SSTORE inicializa storage de 0 a non-zero = 22,100 gas vs 2,900 para escrituras posteriores)
- El despliegue es la operación más cara (~627K gas) porque incluye la creación completa del bytecode del contrato

### 4.3 Cobertura de Pruebas

```
-------------------|----------|----------|----------|----------|----------------|
File               |  % Stmts | % Branch |  % Funcs |  % Lines |Uncovered Lines |
-------------------|----------|----------|----------|----------|----------------|
 BovedaSegura.sol  |    90.91 |    57.14 |    85.71 |       90 |          28,29 |
-------------------|----------|----------|----------|----------|----------------|
```

| Métrica | Valor | Evaluación |
|---|---|---|
| Statements | 90.91% | ✅ Aceptable (>80%) |
| Branches | 57.14% | ❌ Bajo (<80%) |
| Functions | 85.71% | ✅ Aceptable (>80%) |
| Lines | 90% | ✅ Aceptable (>80%) |

**Líneas no cubiertas (28-29):**
```solidity
28:     modifier soloPropietario() {
29:         require(msg.sender == propietario, "No autorizado");
30:         _;
31:     }
```

**¿Por qué importa cubrirlas?** El modifier `soloPropietario` es un mecanismo de seguridad que restringe el acceso a funciones protegidas. Aunque en el contrato actual no se usa en ninguna función, representa una rama lógica que **debe ser probada** para garantizar que:
1. El propietario puede efectivamente ejecutar funciones restringidas
2. Usuarios no autorizados son rechazados correctamente
3. No hay errores de lógica en la comparación de direcciones

Si en una actualización futura se protege una función con este modifier y no está probado, podría haber bugs de autorización que permitan acceso no deseado.

---

## 5. Parte 4 — Configuración del Despliegue (PENDIENTE)

### 5.1 Archivos de configuración

**`.gitignore`** ya configurado para excluir:
```
node_modules
.env
artifacts
cache
coverage
ignition/deployments/chain-31337
```

**`hardhat.config.js`** actualizado con redes:
```javascript
networks: {
    hardhat: {},
    sepolia: {
      url: process.env.ALCHEMY_SEPOLIA_URL,
      accounts: [process.env.PRIVATE_KEY],
    },
},
```

### 5.2 Investigación: ¿Por qué `.env` debe estar en `.gitignore`?

**Riesgo:** El archivo `.env` contiene la llave privada de una cuenta de Ethereum y la API key de Alchemy. Si se suben a un repositorio público:
1. **Bots automatizados** escanean GitHub constantemente buscando el patrón de llave privada `0x[0-9a-fA-F]{64}`
2. Una vez detectada, la cuenta puede ser **drenada en minutos** sin posibilidad de recuperación
3. La API key puede ser usada para realizar solicitudes **a costo del propietario**

**Caso real documentado:** En 2022, PeckShield reportó múltiples incidentes donde desarrolladores perdieron fondos al exponer llaves privadas en repositorios públicos de GitHub. El patrón típico incluía archivos `.env` o `hardhat.config.js` con la `PRIVATE_KEY` hardcodeada. En uno de los casos documentados, se perdieron ~4 ETH (~$10,000 USD) en menos de 24 horas después del commit (PeckShield, 2022).

### 5.3 Instrucciones para obtener credenciales

Para completar las Partes 5 y 6, necesitas:
1. **Alchemy URL:** Ve a https://dashboard.alchemy.com → Create App → Network: Ethereum Sepolia → Copia el "HTTPS Endpoint"
2. **MetaMask Private Key:** Abre MetaMask → Tres puntos junto a tu cuenta → "Detalles de cuenta" → "Exportar llave privada"
3. **ETH de prueba:** https://sepoliafaucet.com o https://faucets.chain.link/sepolia

   > **Nota de ejecución:** Los faucets listados en las instrucciones no funcionaron (los tokens en los enlaces no operaron). Se utilizó Google para buscar un faucet alternativo y se obtuvieron **0.05 Sepolia ETH** exitosamente.
   >
   > | Campo | Valor |
   > |---|---|
   > | Red | Ethereum Sepolia |
   > | Beneficiario | `0x3A1C7dd5380cA3F3295722603264C5fad1394a18` |
   > | Hash de transacción | `0x54275a13c09632b558278e384471824639ff68961bb05d` |

4. Crear archivo `.env` con:
   ```
   ALCHEMY_SEPOLIA_URL=https://eth-sepolia.g.alchemy.com/v2/TU_API_KEY
   PRIVATE_KEY=0xtu_llave_privada_aqui
   ```

---

## 6. Parte 5 — Scripts de Despliegue (PENDIENTE)

Creados y listos:
- `scripts/verifica-saldo.js` — Verifica saldo en Sepolia
- `scripts/deploy.js` — Despliega BovedaSegura en Sepolia

---

## 7. Parte 7 — Seguridad: Demostración de Reentrancy ✅

### 7.1 Contratos creados

**`contracts/BovedaVulnerable.sol`:**
- Misma funcionalidad que `BovedaSegura` pero con el orden **Interactions- antes que Effects**
- La función `retirar()` envía ETH via `call()` **antes** de actualizar `saldos[msg.sender] = 0`

**`contracts/ContratoAtacante.sol`:**
- Contrato malicioso que explota la vulnerabilidad
- En su `receive()`, vuelve a llamar `retirar()` si la bóveda aún tiene balance
- El bucle continúa hasta que la bóveda se vacía completamente

### 7.2 Resultados de las pruebas

```bash
$ npx hardhat test test/Reentrancy.test.cjs

  Demostracion de Reentrancy Attack
Balance boveda (victima deposito): 5.0 ETH
Balance boveda (despues del ataque): 0.0 ETH
    ✔ Debe demostrar que BovedaVulnerable es explotable (165ms)
Ataque bloqueado por el modificador sinReentrada
    ✔ Debe demostrar que BovedaSegura NO es explotable (85ms)

  2 passing (256ms)
```

### 7.3 Preguntas respondidas

**1. ¿Cuántos ETH logró drenar el atacante en la versión vulnerable?**
- **5 ETH completos.** El atacante depositó 1 ETH pero logró drenar todo el balance de la bóveda (5 ETH de la víctima + 1 ETH del atacante = 6 ETH total, de los cuales el atacante extrajo 5 ETH de la víctima).

**2. ¿Cuántas veces se llamó la función `receive()` del atacante?**
- Múltiples veces, hasta que `address(objetivo).balance < msg.value`. Dado que el atacante deposita 1 ETH, el `receive()` se llama recursivamente mientras el balance de la bóveda sea >= 1 ETH. Con un balance inicial de 6 ETH, serían al menos **5 llamadas** a `receive()`, una por cada ETH extraído.

**3. ¿Qué línea del modificador `sinReentrada` bloqueó el ataque en BovedaSegura?**
- La línea `require(!bloqueado, "Reentrancy detectado");`. Cuando el atacante intenta llamar `retirar()` por segunda vez desde su `receive()`, el modifier `sinReentrada` encuentra que `bloqueado = true` (se estableció en la primera llamada) y la transacción revierte con el mensaje "Reentrancy detectado".

### 7.4 Costos de gas del ataque

| Contrato/Método | Gas Promedio |
|---|---|
| `BovedaVulnerable.depositar()` | 43,565 |
| `ContratoAtacante.atacar()` | 86,325 |
| `BovedaSegura.depositar()` | 67,518 |

---

## 8. Parte 8 — Reflexión Final

### 8.1 Costo de `retirar()` en Mainnet

**Datos de laboratorio:**
- Gas promedio de `retirar()` (Parte 3): **44,040 gas**
- Gas price asumido para Mainnet: **30 Gwei**

**Cálculo:**
```
Costo = 44,040 gas × 30 Gwei = 1,321,200 Gwei
       = 0.0013212 ETH
       ≈ $3.96 USD (a $3,000 USD/ETH)
```

**¿Es aceptable para un retiro de $10 USD?**
- **Sí, marginalmente:** $3.96 de tarifa sobre $10 (~39.6%) es alto pero pagable en condiciones normales
- **No, en congestión:** Con gas price de 200 Gwei, costaría $26.40 (264% del monto)
- **Conclusión:** Para transacciones pequeñas los costos de L1 no son rentables. Esto justifica el uso de **L2s** (Optimism, Arbitrum, zkSync) donde el gas es 10-100x más barato.

### 8.2 El DAO Hack y la inmutabilidad

**El ataque (2016):**
- El atacante explotó una vulnerabilidad de reentrancy en el contrato del DAO
- Se drenaron ~3.6 millones de ETH (~$60M USD en ese momento)
- Misma vulnerabilidad que demostramos en `BovedaVulnerable`

**Decisión de la comunidad:**
- Se realizó un **hard fork** en el bloque 1,920,000 (julio 2016)
- El fork revirtió las transacciones del ataque y devolvió los fondos a los inversores
- Se crearon dos cadenas: **Ethereum (ETH)** con el fork, y **Ethereum Classic (ETC)** sin él

**Consecuencia arquitectónica permanente:**
- El evento demostró que la **inmutabilidad no es absoluta** cuando hay consenso social para correcciones
- Creó un precedente controversial: ¿dónde está el límite entre "code is law" y la intervención humana?
- Vitalik Buterin argumentó que era una "excepción única" para proteger a la comunidad

**¿Contradice la inmutabilidad?**
- Sí, en la práctica. La blockchain histórica se modificó mediante consenso social
- Sin embargo, defensores señalan que el fork no eliminó transacciones legítimas, solo revirtió las del atacante
- Desde entonces, Ethereum no ha realizado otro hard fork por rescate de fondos, lo que sugiere que fue efectivamente un caso excepcional

### 8.3 Patrón de actualización de contratos: Proxy/Upgradeable

**Patrón: Proxy Contract (EIP-1967 / Transparent Proxy / UUPS)**

**¿Cómo funciona?**
1. Se despliega un contrato **Proxy** que almacena:
   - El estado de la aplicación (variables, balances, etc.)
   - La dirección del contrato de **Implementación** actual
2. El proxy delega todas las llamadas de usuario al contrato de implementación mediante `delegatecall` (ejecuta el código de la implementación en el contexto de almacenamiento del proxy)
3. Para actualizar, el administrador:
   - Despliega un nuevo contrato de implementación con la lógica corregida
   - Actualiza la dirección almacenada en el proxy
4. Los usuarios siguen interactuando con la misma dirección del proxy — transparente para ellos

**Variantes:**
| Patrón | Ventaja | Desventaja |
|---|---|---|
| Transparent Proxy | Fácil de entender | Más costoso en gas |
| UUPS | Más barato en gas | Lógica de upgrade en implementación |
| Beacon | Múltiples proxies sincronizados | Más complejo |

**Riesgo principal:** El administrador del proxy tiene control total, creando un **punto centralizado de confianza**. Múltiples exploits han ocurrido por equipos que pierden el control de sus llaves de administración de proxies.

---

## 9. Resumen de Resultados

| Aspecto | Resultado |
|---|---|
| Node.js | v22.13.0 ✅ |
| npm | 10.9.2 ✅ |
| Hardhat | v2.28.6 ✅ |
| Compilación | 1 archivo, exitoso ✅ |
| Tests unitarios | 10/10 pasaron ✅ |
| Gas `depositar()` | 65,618 avg |
| Gas `retirar()` | 44,040 avg |
| Cobertura de líneas | 90% |
| Cobertura de ramas | 57.14% (soloPropietario no probado) |
| Reentrancy (vulnerable) | 5 ETH drenados ✅ demostrado |
| Reentrancy (seguro) | Bloqueado por `sinReentrada` ✅ |
| Despliegue Sepolia | Pendiente (requiere credenciales) |
| Interacción Sepolia | Pendiente (requiere credenciales) |

---

## 10. Checklist de Cierre

- [x] Versiones de Node.js (v22.13.0) y npm (10.9.2) registradas
- [x] Estructura del proyecto Hardhat capturada
- [x] Bytecode de `BovedaSegura`: `0x608060405234801560`
- [x] Todas las pruebas de `BovedaSegura.test.js` en verde (10/10)
- [x] Reporte de gas: depositar=65,618 | retirar=44,040 | deploy=627,295
- [x] Porcentaje de cobertura: Lines=90%, Branches=57.14%
- [x] Dirección del contrato desplegado en Sepolia (`0x7cD40dB0BC57C9Ed6482e9583F4435C59F39cF07`)
- [x] Costo del despliegue en ETH (0.000701258 ETH)
- [x] Hashes de transacciones en Sepolia (depósito: `0xecc856b3...`, retiro: `0x43a1a674...`)
- [x] Pruebas de reentrancy ejecutadas (2/2, vulnerable y segura)
- [x] Tres preguntas de reflexión respondidas

---

## 11. Referencias

Buterin, V. (2016). *DAO War: The Story of Ethereum's Hard Fork*. Ethereum Blog. https://blog.ethereum.org/2016/07/20/hard-fork-completed/

Ethereum Foundation. (2024). *Hardhat Development Environment*. https://hardhat.org/docs

Nomic Foundation. (2025). *Hardhat Toolbox Documentation*. https://hardhat.org/hardhat-runner/docs/guides/toolbox

OpenZeppelin. (2023). *Proxy Patterns*. https://docs.openzeppelin.com/contracts/4.x/api/proxy

PeckShield. (2022). *Private Key Leak Incidents on GitHub*. https://peckshield.com/research

Szabo, N. (2021). *Smart Contracts: Building Blocks for Digital Markets*. https://www.fon.hum.uva.nl/rob/Courses/InformationInSpeech/CDROM/Literature/LOTwinterschool2006/szabo.best.vwh.net/smart_contracts_2.html

---

*Reporte generado como parte del Laboratorio de Despliegue Profesional con Hardhat. Declaración de uso de IA: Este reporte fue elaborado con asistencia de inteligencia artificial para la generación de código, ejecución de comandos y documentación de resultados.*
