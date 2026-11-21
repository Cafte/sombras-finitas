// Predicción del diagrama del estudiante (nivel con «predicción vs realidad»).
// Dado el AFD dibujado S y las señales emitidas hasta ahora, ¿qué conducta predice S tras la señal a?
// Devuelve 'dormido' | 'despierto' | null (si el diagrama no puede responder: sin inicial o con transiciones faltantes).
export function predecir(S, senales, a) {
  if (!S || S.q0 == null) return null;
  let q = S.extendida(S.q0, senales);
  if (q === null) return null;
  q = S.paso(q, a);
  if (q === null) return null;
  return S.F.has(q) ? 'dormido' : 'despierto';
}
