export function evaluarRiesgo({ asistencia, promedio, entregasATiempo, incidencias }) {
  const faltas = Math.max(0, 100 - asistencia) * 0.30;
  const brechaAcademica = Math.max(0, 11 - promedio) / 11 * 40;
  const entregas = (100 - entregasATiempo) * 0.18;
  const conducta = Math.min(incidencias / 8, 1) * 12;
  const puntajeBase = Math.min(100, faltas + brechaAcademica + entregas + conducta);

  // Tres árboles deterministas simulan un bosque interpretable, sin aleatoriedad ni entrenamiento externo.
  const arboles = [
    () => asistencia < 65 ? (promedio < 10 ? 92 : 72) : asistencia < 80 ? (promedio < 11 ? 66 : 43) : (promedio < 11 ? 54 : entregasATiempo < 60 ? 39 : 14),
    () => promedio < 9 ? (asistencia < 70 ? 94 : 73) : promedio < 12 ? (entregasATiempo < 50 ? 68 : asistencia < 75 ? 58 : 37) : (incidencias >= 4 ? 51 : asistencia < 75 ? 45 : 16),
    () => entregasATiempo < 35 ? (asistencia < 65 ? 91 : promedio < 11 ? 75 : incidencias >= 4 ? 64 : 52) : incidencias >= 5 ? (asistencia < 75 ? 78 : 53) : asistencia < 60 ? 63 : promedio < 11 ? 49 : asistencia < 80 ? 36 : 13,
  ];
  const votoBosque = arboles.reduce((suma, arbol) => suma + arbol(), 0) / arboles.length;
  const puntaje = Math.round(Math.min(100, puntajeBase * 0.55 + votoBosque * 0.45));

  const nivel = puntaje >= 50 ? 'Alto' : puntaje >= 30 ? 'Medio' : 'Bajo';
  const recomendaciones = [];

  if (asistencia < 75) recomendaciones.push('Coordinar seguimiento de asistencia con la familia.');
  if (promedio < 11) recomendaciones.push('Programar refuerzo en competencias con menor logro.');
  if (entregasATiempo < 60) recomendaciones.push('Acordar metas semanales de entrega y revisar avances.');
  if (incidencias >= 3) recomendaciones.push('Realizar tutoría breve y establecer acuerdos de convivencia.');
  if (recomendaciones.length === 0) recomendaciones.push('Mantener seguimiento formativo y reconocer sus avances.');

  return { puntaje, nivel, recomendaciones };
}

export function calcularFactores(db, estudianteId, cursoId) {
  const notas = db.prepare(`
    SELECT AVG(calificacion) AS promedio,
           AVG(CASE WHEN entrega_a_tiempo = 1 THEN 100.0 ELSE 0.0 END) AS entregas
    FROM notas WHERE estudiante_id = ? AND curso_id = ?
  `).get(estudianteId, cursoId);
  const asistencia = db.prepare(`
    SELECT COUNT(*) AS sesiones,
           SUM(CASE WHEN estado = 'Ausente' THEN 1 ELSE 0 END) AS ausencias,
           SUM(CASE WHEN estado = 'Tardanza' THEN 1 ELSE 0 END) AS tardanzas,
           SUM(CASE WHEN estado = 'Justificado' THEN 1 ELSE 0 END) AS justificados
    FROM asistencia WHERE estudiante_id = ? AND curso_id = ?
  `).get(estudianteId, cursoId);
  const conducta = db.prepare(`
    SELECT COUNT(*) AS total FROM conductas
    WHERE estudiante_id = ? AND (curso_id = ? OR curso_id IS NULL)
  `).get(estudianteId, cursoId);

  const sesiones = Number(asistencia.sesiones) || 0;
  const ausencias = Number(asistencia.ausencias) || 0;
  const tardanzas = Number(asistencia.tardanzas) || 0;
  const justificados = Number(asistencia.justificados) || 0;
  const tardanzasPorInasistencia = Number(db.prepare(`
    SELECT valor FROM configuracion_academica WHERE clave = 'tardanzas_por_inasistencia'
  `).get()?.valor) || 3;
  const sesionesEvaluables = sesiones - justificados;
  const faltasEquivalentes = ausencias + Math.floor(tardanzas / tardanzasPorInasistencia);
  return {
    asistencia: sesionesEvaluables ? Math.max(0, sesionesEvaluables - faltasEquivalentes) / sesionesEvaluables * 100 : 100,
    promedio: Number(notas.promedio) || 0,
    entregasATiempo: notas.entregas == null ? 100 : Number(notas.entregas),
    incidencias: Number(conducta.total) || 0,
    sesiones,
    ausencias,
    tardanzas,
    justificados,
    tardanzasPorInasistencia,
  };
}

export function guardarPrediccion(db, estudianteId, cursoId) {
  const factores = calcularFactores(db, estudianteId, cursoId);
  const resultado = evaluarRiesgo(factores);
  db.prepare(`
    INSERT INTO predicciones_riesgo
      (estudiante_id, curso_id, asistencia, promedio, entregas_a_tiempo, incidencias, puntaje, nivel, recomendaciones, actualizada_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    ON CONFLICT(estudiante_id, curso_id) DO UPDATE SET
      asistencia = excluded.asistencia,
      promedio = excluded.promedio,
      entregas_a_tiempo = excluded.entregas_a_tiempo,
      incidencias = excluded.incidencias,
      puntaje = excluded.puntaje,
      nivel = excluded.nivel,
      recomendaciones = excluded.recomendaciones,
      actualizada_en = excluded.actualizada_en
  `).run(
    estudianteId,
    cursoId,
    factores.asistencia,
    factores.promedio,
    factores.entregasATiempo,
    factores.incidencias,
    resultado.puntaje,
    resultado.nivel,
    JSON.stringify(resultado.recomendaciones),
  );
  return { ...factores, ...resultado };
}
