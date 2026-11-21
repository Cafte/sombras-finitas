# Sombras Finitas

Videojuego de sigilo y deducción (PWA) para aprender **Autómatas Finitos Deterministas**. Los guardias son AFD ocultos
`M = (Q, Σ, δ, q0, F)`; el jugador deduce su comportamiento, lo dibuja en un cuaderno y el motor formal lo valida por
equivalencia. Fuente de verdad: `Sombras_Finitas_Documento_IEEE_v5.docx` (Drive › GRUPO 6 - Teoría Computación BR).

## Instalación y ejecución

No hay dependencias (HTML5 + CSS3 + JavaScript ES6, sin frameworks ni backend). Solo se necesita un servidor estático
(los módulos ES y el Service Worker no funcionan con `file://`):

```bash
cd "Sombras finitas"
python -m http.server 8080
```

Abrir `http://localhost:8080`. En el celular: abrir la URL (HTTPS en producción) → «Agregar a la pantalla de inicio».
Tras la primera visita funciona sin conexión.

Pruebas del motor (Node ≥ 18, sin dependencias):

```bash
npm test            # equivale a: node --test pruebas/*.mjs
```

`pruebas/motor.test.mjs` cubre el motor, el juego y los datos; `pruebas/matriz.test.mjs` implementa la matriz PF01–PF14 de la Tabla XVI del documento.

Regenerar íconos PNG: `node tools/generar-iconos.mjs`. Al publicar una versión nueva, cambiar `VERSION` en `sw.js`.

## Cómo se juega (manual básico)

1. **Observa.** Cada botón de señal (a, b, c) emite un símbolo de Σ; todos los guardias aplican su δ.
2. Guardia en estado de **aceptación = dormido** (no detecta). Cualquier otro estado = **despierto**: detecta a ≤ 2 casillas
   (distancia Manhattan). Las **sombras** moradas te ocultan. La **bitácora** muestra una cinta con las señales emitidas (cada símbolo con su color; la última resaltada) y una cronología con ▼/▲ cuando un guardia se duerme o se despierta; la vista «Por conducta» agrupa las cadenas que lo duermen o despiertan, la tanda anterior al reinicio se conserva atenuada y al tocar una fila puedes probar esa cadena en tu cuaderno.
   «Reiniciar guardias» los devuelve a q₀.
3. **Dibuja** en el cuaderno: herramientas Estado / Transición / Mover / Inicial / Aceptación / Borrar (pulsación larga
   sobre un estado = alternar aceptación; al crear un estado se ve una vista previa que puedes arrastrar antes de soltar, y si queda sobre otro se separa solo). La tabla de transición es editable y sirve de alternativa accesible al lienzo.
   Puedes simular cadenas sobre tu diagrama.
4. **Valida.** Si el diagrama está incompleto se indica qué falta; si no es equivalente se muestra un **contraejemplo mínimo**.
5. Con el diagrama correcto la **salida se abre**; llega a ella. Teclado: flechas, `a b c`, `r`, `n`, `Esc`.

| Nivel | Σ | Reto | Qué hay que hacer |
|---|---|---|---|
| 1 | {a,b} | Deducción | AFD de 2 estados («termina en a») |
| 2 | {a,b} | Deducción | 4 estados con **estado trampa** (`ab·a*`) |
| 3 | {a,b,c} | Minimización | 6 estados → dibujar el **mínimo** (3); equivalente pero no mínimo se rechaza. Ayudas: *predicción vs realidad* y *cada señal es un turno* (los guardias patrullan) |
| 4 | {a,b,c} | Equivalencia | Dibujar el guardia A y decidir si A≡B y A≡C (con cadena distinguidora verificada por el motor). Dos zonas con lenguajes **disjuntos**: ninguna cadena duerme a los tres a la vez |
| 5 (bonus) | {a,b} | El camino es la cadena | Sin botones: cada casilla con letra que pisas emite esa señal; hay que elegir una ruta con un número par de «a» |

**Mecánicas didácticas por nivel**

- **Patrulla por turnos (niveles 3 y 4).** Un guardia despierto avanza un paso por su ruta (ida y vuelta, líneas punteadas en el mapa) y uno dormido se queda quieto, de modo que el movimiento solo depende de si el estado es de aceptación y la minimización/equivalencia no cambian. Si la casilla siguiente está ocupada, el guardia espera. Las rutas están en `data/niveles.json` (`patrullas`); en el nivel 4, A y C van en sincronía (vertical) y B de lado, a propósito, para que el movimiento no revele qué autómatas son equivalentes.
- **Nivel 3 — predicción vs realidad y costo de señal.** Con el diagrama completo en el cuaderno, cada botón de señal muestra lo que *tu* autómata predice (`→ dorm.` / `→ desp.`); si la realidad no coincide, aparece un aviso y la bitácora marca ⚠ (✓ si coincide). Cada señal es además un turno para los guardias que patrullan, y al ganar se compara tu cadena con la más corta que duerme a todos (`Nivel.mejorCadena()`).
- **Nivel 4 — zonas con lenguajes disjuntos.** A y B (equivalentes) duermen con cadenas que terminan en `a`; C con cadenas que terminan en `c`. Como L(A) ∩ L(C) = ∅, ninguna cadena los duerme a todos: hay que dormir la primera zona (`a`), cruzarla, y ya en el refugio dormir la segunda (`c`).
- **Nivel 5 (bonus) — el camino es la cadena.** Sin botones: pisar una casilla con letra emite esa señal a los guardias (`camino: true`). El guardia reconoce «número par de aes» (el M1 del documento).

Todos los niveles tienen solución demostrada por un solver (búsqueda en anchura sobre jugador y guardias) en `pruebas/niveles.test.mjs`. El documento IEEE v5 todavía describe a los guardias como puestos fijos y cuatro niveles.

La pantalla **Diagnóstico** aplica el test inicial y final (6 preguntas equivalentes, respuestas calculadas por el motor) y
muestra Pre, Pos y ganancia normalizada `g = (Pos − Pre)/(100 − Pre)`.

## Arquitectura

```
index.html · css/estilos.css · manifest.webmanifest · sw.js
js/motor/      automata.js  equivalencia.js  minimizador.js   ← motor formal, sin dependencias de la UI (RNF03)
js/juego/      guardia.js  nivel.js  mapa.js (Partida)  diagnostico.js
js/cuaderno/   cuaderno.js            ← modelo del diagrama, conversión a Automata y validación
js/datos/      almacen.js             ← IndexedDB (8 stores = Tabla X) con respaldo en memoria
js/ui/         vistaMapa  cuadernoUI  juegoUI  diagnosticoUI  sonido  dom
js/app.js                             ← arranque, navegación, flujo de nivel
data/niveles.json                     ← niveles y AFD ocultos (datos iniciales)
pruebas/ · tools/ · icons/
```

Dependencia en un solo sentido: UI → juego/cuaderno → motor; `Almacen` es el único acceso a datos. Sin servidor, cuentas ni
datos personales (perfil = código anónimo).

## Resultados de pruebas

**Automáticas (Node, todas aprobadas: motor/juego/datos, matriz PF, patrullas y solver de niveles):** δ* y `acepta` (incl. cadena vacía y propiedad δ*(q,wa)=δ(δ*(q,w),a) exhaustiva hasta
longitud 4 en todos los AFD), completitud, estados trampa, alcanzables, minimización (6→3 con clases esperadas), equivalencia
(contraejemplo mínimo, simetría, contraste con fuerza bruta), validación del cuaderno (flujo alterno 2a, contraejemplo, determinismo,
mínimo exigido), reglas del mapa (radio, sombras, paredes, salida sellada/abierta), resolubilidad de los 4 niveles, `Almacen`
(perfil anónimo, progreso, dibujo, validaciones, integridad, idempotencia, unicidad), diagnósticos y ganancia normalizada.

**En navegador (panel integrado de Claude Code, Chromium, emulación 375×812 y 320×568):** instalación de datos y menú; nivel 1 jugado
con clics reales (señales, movimiento, sala sellada, cuaderno con creación/aceptación/arrastre de transición, validación fallida con
contraejemplo «ab», corrección, simulación de cadena, apertura de salida, victoria); derrota por radio de ruido; niveles 2–4 completados
por la interfaz (trampa, mínimo, pares de equivalencia con respuestas erróneas y correctas); desbloqueo de niveles; persistencia tras
recargar (progreso y dibujo en IndexedDB); diagnósticos inicial/final con g = 0,75 verificada; Service Worker activo con 25 archivos en
caché y **recarga con el servidor apagado** (juego y progreso intactos); sin desbordamiento horizontal en 320 px.

## Pruebas manuales (PF10 y PF14, en el celular)

- **PF10** — En el cuaderno: tocar el lienzo crea un estado; arrastrar de un estado a otro abre el selector de símbolos y crea la transición; pulsación larga alterna aceptación.
- **PF14** — Tras la primera visita con conexión, instalar en la pantalla de inicio, activar modo avión y abrir: debe cargar y conservar el progreso.
- Anotar fecha, dispositivo y navegador; el resultado se refleja en la Tabla XVI del documento.

## Matriz de cumplimiento (documento IEEE v3)

| Req. | Implementación | Estado |
|---|---|---|
| RF01 tupla, δ*, ε | `automata.js` | Cumple · probado |
| RF02 trampa, equivalencia, minimización | `automata.js`, `equivalencia.js`, `minimizador.js` | Cumple · probado |
| RF03 guardias = AFD oculto | `guardia.js`, `mapa.js` | Cumple · probado |
| RF04 mapa por casillas, movimiento, radio de ruido | `nivel.js`, `mapa.js`, `vistaMapa.js` | Cumple · probado |
| RF05 cuaderno interactivo | `cuaderno.js`, `cuadernoUI.js` | Cumple · probado (toque/arrastre en el panel; ver límites) |
| RF06 validación por equivalencia con retroalimentación | `cuaderno.js` | Cumple · probado |
| RF07 niveles crecientes (4, Tabla XIV) | `niveles.json` | Cumple · probado |
| RF08 progreso, niveles, diagramas locales | `almacen.js` (incluye las respuestas del reto de equivalencia en `progreso.pares_resueltos`) | Cumple · probado |
| RNF01 offline + instalable | `sw.js`, manifiesto, íconos | Offline probado; instalación a pantalla de inicio **no probada** en un celular |
| RNF02 interfaz táctil vertical | CSS responsive, eventos de puntero | Probado en emulación; **no en un dispositivo táctil real** |
| RNF03 motor desacoplado | `js/motor/` sin imports de UI | Cumple · verificado por las pruebas en Node |
| RNF04 sin servidor/cuentas/datos sensibles | perfil con código anónimo | Cumple |
| CU07/CU08 diagnósticos | `diagnostico.js`, `diagnosticoUI.js` | Cumple |

## Decisiones de diseño y límites (lectura honesta)

- El documento define que el guardia tiene una *conducta visible* según su estado (patrullar/vigilar/perseguir) pero no la mapea.
  Decisión: **aceptación = dormido (radio 0)**, resto = despierto (radio 2). Solo se observa aceptación, de modo que la minimización
  tiene sentido (estados equivalentes son indistinguibles). Los guardias son puestos fijos (el documento v5 describe esta conducta dormido/despierto en la Sección IX-E).
- La salida se sella hasta validar el diagrama (el documento no define condición de victoria; se tomó el flujo de la Fig. 8).
  En el nivel 4 además deben resolverse los dos pares de equivalencia; esas respuestas se guardan en `Almacen`
  (columna `pares_resueltos` de la tabla `progreso`, incorporada a la Tabla X del documento v5). Al reabrir un nivel, el diagrama guardado se revalida en silencio.
- El documento v5 incluye la Sección X (matriz PF01–PF14) y las Secciones XI–XIV; los casos PF10, PF13 y PF14 se comprobaron en
  emulación de navegador y quedan pendientes de repetir en un teléfono físico. Los diagnósticos aún no se han aplicado a estudiantes,
  por lo que los resultados pedagógicos no se reportan.
- Los gestos del cuaderno se probaron con eventos de puntero del navegador y con la tabla de transición; no hay prueba en un
  teléfono físico. Las skills de diseño `taste-skill`/`impeccable`/`emil-design-eng` no se cargaron: se aplicaron criterios
  propios (paleta rojo/dorado del documento, jerarquía, objetivos táctiles ≥ 44 px, foco visible, `prefers-reduced-motion`, ARIA).
- El sonido es sintetizado (Web Audio) y solo se probó que no genera errores, no su calidad auditiva.
- Falta el despliegue HTTPS (Sprint 7) y la aplicación real de los diagnósticos a estudiantes: son actividades externas al código.
