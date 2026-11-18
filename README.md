# Sombras Finitas

Videojuego de sigilo y deducción (PWA) para aprender **Autómatas Finitos Deterministas**. Los guardias son AFD ocultos
`M = (Q, Σ, δ, q0, F)`; el jugador deduce su comportamiento, lo dibuja en un cuaderno y el motor formal lo valida por
equivalencia. Fuente de verdad: `Sombras_Finitas_Documento_IEEE_v3.docx` (Drive › GRUPO 6 - Teoría Computación BR).

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
node --test pruebas/motor.test.mjs
```

Regenerar íconos PNG: `node tools/generar-iconos.mjs`. Al publicar una versión nueva, cambiar `VERSION` en `sw.js`.

## Cómo se juega (manual básico)

1. **Observa.** Cada botón de señal (a, b, c) emite un símbolo de Σ; todos los guardias aplican su δ.
2. Guardia en estado de **aceptación = dormido** (no detecta). Cualquier otro estado = **despierto**: detecta a ≤ 2 casillas
   (distancia Manhattan). Las **sombras** moradas te ocultan. La **bitácora** registra qué cadena produjo qué conducta.
   «Reiniciar guardias» los devuelve a q₀.
3. **Dibuja** en el cuaderno: herramientas Estado / Transición / Mover / Inicial / Aceptación / Borrar (pulsación larga
   sobre un estado = alternar aceptación). La tabla de transición es editable y sirve de alternativa accesible al lienzo.
   Puedes simular cadenas sobre tu diagrama.
4. **Valida.** Si el diagrama está incompleto se indica qué falta; si no es equivalente se muestra un **contraejemplo mínimo**.
5. Con el diagrama correcto la **salida se abre**; llega a ella. Teclado: flechas, `a b c`, `r`, `n`, `Esc`.

| Nivel | Σ | Reto | Qué hay que hacer |
|---|---|---|---|
| 1 | {a,b} | Deducción | AFD de 2 estados («termina en a») |
| 2 | {a,b} | Deducción | 4 estados con **estado trampa** (`ab·a*`) |
| 3 | {a,b,c} | Minimización | 6 estados → dibujar el **mínimo** (3); equivalente pero no mínimo se rechaza |
| 4 | {a,b,c} | Equivalencia | Dibujar el guardia A y decidir si A≡B y A≡C (con cadena distinguidora verificada por el motor) |

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

**Automáticas (Node, 29/29 aprobadas):** δ* y `acepta` (incl. cadena vacía y propiedad δ*(q,wa)=δ(δ*(q,w),a) exhaustiva hasta
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
| RF08 progreso, niveles, diagramas locales | `almacen.js` | Cumple · probado |
| RNF01 offline + instalable | `sw.js`, manifiesto, íconos | Offline probado; instalación a pantalla de inicio **no probada** en un celular |
| RNF02 interfaz táctil vertical | CSS responsive, eventos de puntero | Probado en emulación; **no en un dispositivo táctil real** |
| RNF03 motor desacoplado | `js/motor/` sin imports de UI | Cumple · verificado por las pruebas en Node |
| RNF04 sin servidor/cuentas/datos sensibles | perfil con código anónimo | Cumple |
| CU07/CU08 diagnósticos | `diagnostico.js`, `diagnosticoUI.js` | Cumple |

## Decisiones de diseño y límites (lectura honesta)

- El documento define que el guardia tiene una *conducta visible* según su estado (patrullar/vigilar/perseguir) pero no la mapea.
  Decisión: **aceptación = dormido (radio 0)**, resto = despierto (radio 2). Solo se observa aceptación, de modo que la minimización
  tiene sentido (estados equivalentes son indistinguibles). Los guardias son puestos fijos (el documento no exige patrullas).
- La salida se sella hasta validar el diagrama (el documento no define condición de victoria; se tomó el flujo de la Fig. 8).
  En el nivel 4 además deben resolverse los dos pares de equivalencia; esas respuestas se guardan en `localStorage`
  (el esquema de la Tabla X no tiene tabla para ello). Al reabrir un nivel, el diagrama guardado se revalida en silencio.
- El documento recibido llega hasta la Sección IX; **la Sección X (pruebas del documento) y los resultados no estaban**, por lo que la
  matriz de pruebas aquí es propia. No se revisaron los .pptx ni el video de la carpeta; el `Sombras_Finitas_Proyecto.docx` original
  (v1) tampoco se leyó: se usó la versión IEEE v3, la más reciente.
- Los gestos del cuaderno se probaron con eventos de puntero del navegador y con la tabla de transición; no hay prueba en un
  teléfono físico. Las skills de diseño `taste-skill`/`impeccable`/`emil-design-eng` no se cargaron: se aplicaron criterios
  propios (paleta rojo/dorado del documento, jerarquía, objetivos táctiles ≥ 44 px, foco visible, `prefers-reduced-motion`, ARIA).
- El sonido es sintetizado (Web Audio) y solo se probó que no genera errores, no su calidad auditiva.
- Falta el despliegue HTTPS (Sprint 7) y la aplicación real de los diagnósticos a estudiantes: son actividades externas al código.
