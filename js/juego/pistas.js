// Pistas dinámicas: se calculan con lo que el jugador ya hizo (lógica pura, sin interfaz).
// Las pistas fijas de cada nivel (de suave a casi la solución) están en data/niveles.json.

const cad = w => (w === '' ? 'la cadena vacía (ε)' : `«${w}»`);

// Qué ha observado el jugador: para cada guardia, la cadena más corta con la que lo ha visto dormido.
// `filas` son las filas de la bitácora ({ cadena, dorm: [bool por guardia] }), incluidas las de tandas anteriores.
export function observacion(guardias, filas) {
  return guardias.map((g, k) => {
    const dormidas = filas.filter(f => f.dorm[k]).sort((a, b) => a.cadena.length - b.cadena.length);
    return dormidas.length
      ? `Guardia ${g.id}: lo viste dormido con ${cad(dormidas[0].cadena)}.`
      : `Guardia ${g.id}: todavía no lo has visto dormido.`;
  });
}

// Qué le falla al diagrama del estudiante (o confirma que ya es correcto).
export function pistaDiagrama(cuaderno, nivel) {
  if (!cuaderno || cuaderno.estados.length === 0) {
    return 'Todavía no has dibujado nada: abre el cuaderno y crea un estado por cada conducta distinta que hayas observado.';
  }
  const r = cuaderno.validar(nivel.automataObjetivo, { exigirMinimo: nivel.tipo === 'minimizacion' });
  switch (r.estado) {
    case 'incompleto':
      return r.motivos[0];
    case 'no-equivalente':
      return `Con la cadena ${cad(r.contraejemplo)} tu diagrama ${r.dibujoAcepta ? 'acepta' : 'rechaza'}, pero el guardia ${r.objetivoAcepta ? 'se duerme' : 'sigue despierto'}. Pruébala en el juego y corrige tu diagrama.`;
    case 'no-minimo':
      return `Tu diagrama funciona, pero tiene ${r.tusEstados} estados y el mínimo tiene ${r.minimo}: busca estados que se comporten igual ante toda cadena.`;
    default:
      return nivel.tipo === 'equivalencia'
        ? '¡Tu diagrama ya es correcto! Te falta resolver el reto de equivalencia.'
        : '¡Tu diagrama ya es correcto! Si todavía no se abre la salida, comprueba que el guardia no haya cambiado.';
  }
}
