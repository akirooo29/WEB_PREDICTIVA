import express from 'express';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { carpetaDatos, db } from './db.js';
import { guardarPrediccion } from './modeloRiesgo.js';
import { eliminarAdjuntoLocal, guardarAdjuntoLocal } from './archivosJustificacion.js';
import { filtroVisibilidad, puedeEditarAcademico, puedeVerEstudiante, puedeVerSalon } from './permisos.js';
import { registrarRutasSeguimiento } from './rutasSeguimiento.js';
import { registrarSesionesDemo } from './sesionesDemo.js';

const app = express();
const puerto = Number(process.env.PORT) || 4000;
const fechaLocal = (fecha = new Date()) => `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
const carpetaJustificaciones = join(carpetaDatos, 'justificaciones');
mkdirSync(carpetaJustificaciones, { recursive: true });
app.use(express.json({ limit: '15mb' }));

app.get('/api/salud', (_req, res) => res.json({ estado: 'ok', almacenamiento: 'SQLite local' }));
registrarSesionesDemo(app, db);

function rechazarSinEdicion(req, res) {
  if (puedeEditarAcademico(req.actor)) return false;
  res.status(403).json({ error: 'Este perfil solo puede consultar la información.' });
  return true;
}

app.get('/api/dashboard', (req, res) => {
  const { salon, curso, desde, hasta } = req.query;
  if ((desde && !/^\d{4}-\d{2}-\d{2}$/.test(desde)) || (hasta && !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) || (desde && hasta && desde > hasta)) {
    return res.status(400).json({ error: 'Indica un período válido con formato AAAA-MM-DD.' });
  }
  const condiciones = ['1 = 1'];
  const parametros = [];
  const alcance = filtroVisibilidad(req.actor);
  if (alcance.sql) { condiciones.push(alcance.sql.replace(/^ AND /, '')); parametros.push(...alcance.parametros); }
  if (salon) {
    const salonId = Number(salon);
    if (!Number.isInteger(salonId)) return res.status(400).json({ error: 'El salón seleccionado no es válido.' });
    if (!puedeVerSalon(db, req.actor, salonId)) return res.status(403).json({ error: 'Este perfil no tiene acceso a ese salón.' });
    condiciones.push('e.salon_id = ?');
    parametros.push(salonId);
  }
  if (curso) {
    const cursoId = Number(curso);
    const cursoSalon = db.prepare('SELECT salon_id FROM salon_cursos WHERE curso_id = ?').get(cursoId);
    if (!Number.isInteger(cursoId) || !cursoSalon) return res.status(400).json({ error: 'El curso seleccionado no es válido.' });
    if (!puedeVerSalon(db, req.actor, cursoSalon.salon_id)) return res.status(403).json({ error: 'Este perfil no tiene acceso a ese curso.' });
    condiciones.push('c.id = ?');
    parametros.push(cursoId);
  }
  const where = condiciones.join(' AND ');
  const base = `
    FROM estudiantes e
    JOIN matriculas m ON m.estudiante_id = e.id
    JOIN cursos c ON c.id = m.curso_id
    JOIN salon_cursos sc ON sc.curso_id = c.id
  `;
  const poblacion = db.prepare(`
    SELECT COUNT(DISTINCT e.id) AS estudiantes,
           COUNT(DISTINCT c.id) AS cursos,
           COUNT(DISTINCT CASE WHEN p.nivel = 'Alto' THEN e.id END) AS riesgo_alto
    ${base}
    LEFT JOIN predicciones_riesgo p ON p.estudiante_id = e.id AND p.curso_id = c.id
    WHERE ${where}
  `).get(...parametros);

  const filtrosNotas = [where];
  const parametrosNotas = [...parametros];
  if (desde) { filtrosNotas.push('n.fecha >= ?'); parametrosNotas.push(desde); }
  if (hasta) { filtrosNotas.push('n.fecha <= ?'); parametrosNotas.push(hasta); }
  const promedio = db.prepare(`
    SELECT ROUND(AVG(n.calificacion), 1) AS promedio
    FROM notas n JOIN estudiantes e ON e.id = n.estudiante_id
    JOIN cursos c ON c.id = n.curso_id JOIN salon_cursos sc ON sc.curso_id = c.id
    WHERE ${filtrosNotas.join(' AND ')}
  `).get(...parametrosNotas).promedio;

  const filtrosAsistencia = [where];
  const parametrosAsistencia = [...parametros];
  if (desde) { filtrosAsistencia.push('a.fecha >= ?'); parametrosAsistencia.push(desde); }
  if (hasta) { filtrosAsistencia.push('a.fecha <= ?'); parametrosAsistencia.push(hasta); }
  const tardanzasPorInasistencia = Number(db.prepare(`
    SELECT valor FROM configuracion_academica WHERE clave = 'tardanzas_por_inasistencia'
  `).get()?.valor) || 3;
  const asistencia = db.prepare(`
    SELECT ROUND(AVG(porcentaje), 1) AS asistencia FROM (
      SELECT a.estudiante_id, a.curso_id,
        CASE WHEN COUNT(*) - SUM(CASE WHEN a.estado = 'Justificado' THEN 1 ELSE 0 END) = 0 THEN 100.0
        ELSE MAX(0, (COUNT(*) - SUM(CASE WHEN a.estado = 'Justificado' THEN 1 ELSE 0 END)
          - SUM(CASE WHEN a.estado = 'Ausente' THEN 1 ELSE 0 END)
          - CAST(SUM(CASE WHEN a.estado = 'Tardanza' THEN 1 ELSE 0 END) / ? AS INTEGER)) * 100.0
          / (COUNT(*) - SUM(CASE WHEN a.estado = 'Justificado' THEN 1 ELSE 0 END))) END AS porcentaje
      FROM asistencia a JOIN estudiantes e ON e.id = a.estudiante_id
      JOIN cursos c ON c.id = a.curso_id JOIN salon_cursos sc ON sc.curso_id = c.id
      WHERE ${filtrosAsistencia.join(' AND ')} GROUP BY a.estudiante_id, a.curso_id
    )
  `).get(tardanzasPorInasistencia, ...parametrosAsistencia).asistencia;
  const resumen = { ...poblacion, promedio, asistencia };

  const filtrosEvolucion = [where];
  const parametrosEvolucion = [...parametros];
  if (desde) { filtrosEvolucion.push('n.fecha >= ?'); parametrosEvolucion.push(desde); }
  if (hasta) { filtrosEvolucion.push('n.fecha <= ?'); parametrosEvolucion.push(hasta); }
  const evolucion = db.prepare(`
    SELECT n.fecha, ROUND(AVG(n.calificacion), 1) AS promedio
    FROM notas n JOIN estudiantes e ON e.id = n.estudiante_id
    JOIN cursos c ON c.id = n.curso_id JOIN salon_cursos sc ON sc.curso_id = c.id
    WHERE ${filtrosEvolucion.join(' AND ')} GROUP BY n.fecha ORDER BY n.fecha
  `).all(...parametrosEvolucion);
  const alertas = db.prepare(`
    SELECT p.nivel, COUNT(DISTINCT e.id) AS total FROM predicciones_riesgo p
    JOIN estudiantes e ON e.id = p.estudiante_id JOIN cursos c ON c.id = p.curso_id
    JOIN salon_cursos sc ON sc.curso_id = c.id
    WHERE ${where} GROUP BY p.nivel
  `).all(...parametros);
  res.json({ resumen, alertas, evolucion });
});

app.get('/api/cursos', (_req, res) => {
  const { sql, parametros } = filtroVisibilidad(_req.actor, 'e', 'c');
  res.json(db.prepare(`
    SELECT c.id, c.nombre, c.grado, c.seccion, s.id AS salon_id, s.nombre AS salon,
      u.nombre AS docente, COUNT(DISTINCT m.estudiante_id) AS estudiantes
    FROM cursos c JOIN usuarios u ON u.id = c.docente_id
    JOIN salon_cursos sc ON sc.curso_id = c.id
    JOIN salones s ON s.id = sc.salon_id
    LEFT JOIN matriculas m ON m.curso_id = c.id
    LEFT JOIN estudiantes e ON e.id = m.estudiante_id
    WHERE 1 = 1 ${sql}
    GROUP BY c.id ORDER BY c.grado, c.seccion
  `).all(...parametros));
});

app.get('/api/salones', (req, res) => {
  const fecha = req.query.fecha || fechaLocal();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return res.status(400).json({ error: 'La fecha debe tener formato AAAA-MM-DD.' });
  const { sql, parametros } = filtroVisibilidad(req.actor, 'e', 'c');
  res.json(db.prepare(`
    SELECT s.id, s.nombre, s.grado, s.seccion,
           COUNT(DISTINCT e.id) AS estudiantes,
           SUM(CASE WHEN a.estado IS NOT NULL THEN 1 ELSE 0 END) AS registrados,
           SUM(CASE WHEN a.estado = 'Presente' THEN 1 ELSE 0 END) AS presentes,
           SUM(CASE WHEN a.estado = 'Ausente' THEN 1 ELSE 0 END) AS ausentes,
           SUM(CASE WHEN a.estado = 'Tardanza' THEN 1 ELSE 0 END) AS tardanzas,
           SUM(CASE WHEN a.estado = 'Justificado' THEN 1 ELSE 0 END) AS justificados
    FROM salones s
    JOIN cursos c ON c.id = s.curso_id
    LEFT JOIN estudiantes e ON e.salon_id = s.id
    LEFT JOIN asistencia a ON a.estudiante_id = e.id AND a.curso_id = s.curso_id AND a.fecha = ?
    WHERE 1 = 1 ${sql}
    GROUP BY s.id ORDER BY s.grado DESC, s.seccion
  `).all(fecha, ...parametros));
});

app.get('/api/salones/:salonId/asistencia', (req, res) => {
  const salonId = Number(req.params.salonId);
  const fecha = req.query.fecha || fechaLocal();
  if (!Number.isInteger(salonId) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: 'Revisa el salón y la fecha del registro.' });
  }
  const salon = db.prepare('SELECT id, nombre, grado, seccion, curso_id FROM salones WHERE id = ?').get(salonId);
  if (!salon) return res.status(404).json({ error: 'No se encontró el salón.' });
  if (!puedeVerSalon(db, req.actor, salonId)) return res.status(403).json({ error: 'Este perfil no tiene acceso a ese salón.' });
  const filtroTutor = req.actor.rol === 'Estudiante/Tutor' ? ' AND e.tutor_usuario_id = ?' : '';
  const parametrosTutor = req.actor.rol === 'Estudiante/Tutor' ? [req.actor.id] : [];
  const alumnos = db.prepare(`
        SELECT e.id AS estudiante_id, e.codigo, u.nombre, e.tutor, a.estado,
          ROUND(p.asistencia, 1) AS asistencia_acumulada, p.nivel AS nivel_riesgo,
          (SELECT h.motivo FROM historial_asistencia h WHERE h.estudiante_id = e.id AND h.curso_id = ? AND h.fecha = ? ORDER BY h.id DESC LIMIT 1) AS motivo,
          (SELECT h.archivo_nombre FROM historial_asistencia h WHERE h.estudiante_id = e.id AND h.curso_id = ? AND h.fecha = ? AND h.archivo_ruta IS NOT NULL ORDER BY h.id DESC LIMIT 1) AS archivo_nombre
    FROM estudiantes e
    JOIN usuarios u ON u.id = e.usuario_id
    LEFT JOIN asistencia a ON a.estudiante_id = e.id AND a.curso_id = ? AND a.fecha = ?
    LEFT JOIN predicciones_riesgo p ON p.estudiante_id = e.id AND p.curso_id = ?
    WHERE e.salon_id = ? ${filtroTutor} ORDER BY u.nombre
  `).all(salon.curso_id, fecha, salon.curso_id, fecha, salon.curso_id, fecha, salon.curso_id, salonId, ...parametrosTutor);
  const resumen = alumnos.reduce((conteo, alumno) => {
    if (!alumno.estado) conteo.pendientes += 1;
    else if (alumno.estado === 'Presente') conteo.presentes += 1;
    else if (alumno.estado === 'Ausente') conteo.ausentes += 1;
    else if (alumno.estado === 'Tardanza') conteo.tardanzas += 1;
    else if (alumno.estado === 'Justificado') conteo.justificados += 1;
    return conteo;
  }, { estudiantes: alumnos.length, presentes: 0, ausentes: 0, tardanzas: 0, justificados: 0, pendientes: 0 });
  res.json({ salon, fecha, resumen, alumnos });
});

app.post('/api/salones/:salonId/asistencia', (req, res) => {
  const salonId = Number(req.params.salonId);
  const { fecha, registros } = req.body;
  const estadosValidos = ['Presente', 'Ausente', 'Tardanza', 'Justificado'];
  if (!Number.isInteger(salonId) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha || '') || !Array.isArray(registros) || registros.length === 0 || registros.length > 20) {
    return res.status(400).json({ error: 'Indica fecha y entre 1 y 20 registros de asistencia.' });
  }
  const salon = db.prepare('SELECT id, curso_id FROM salones WHERE id = ?').get(salonId);
  if (!salon) return res.status(404).json({ error: 'No se encontró el salón.' });
  if (rechazarSinEdicion(req, res)) return;
  if (!puedeVerSalon(db, req.actor, salonId)) return res.status(403).json({ error: 'Este perfil no puede registrar asistencia en ese salón.' });
  const ids = registros.map((registro) => registro.estudianteId);
  if (new Set(ids).size !== ids.length || registros.some((registro) => !Number.isInteger(registro.estudianteId) || !estadosValidos.includes(registro.estado) || String(registro.motivo || '').length > 500 || (registro.estado === 'Justificado' && String(registro.motivo || '').trim().length < 3) || (registro.archivo && registro.estado !== 'Justificado'))) {
    return res.status(400).json({ error: 'Cada alumno debe tener un estado válido y no repetirse.' });
  }
  const cantidadEnSalon = Number(db.prepare(`
    SELECT COUNT(*) AS total FROM estudiantes WHERE salon_id = ? AND id IN (${ids.map(() => '?').join(',')})
  `).get(salonId, ...ids).total);
  if (cantidadEnSalon !== ids.length) return res.status(400).json({ error: 'Uno o más alumnos no pertenecen a este salón.' });

  const adjuntos = [];
  try {
    for (const registro of registros) {
      const adjunto = registro.archivo ? guardarAdjuntoLocal(registro.archivo, carpetaJustificaciones) : null;
      if (adjunto) adjuntos.push(adjunto.rutaCompleta);
      registro.adjuntoLocal = adjunto;
    }
  } catch (error) {
    adjuntos.forEach(eliminarAdjuntoLocal);
    return res.status(400).json({ error: error.message });
  }

  const guardarAsistencia = db.prepare(`
    INSERT INTO asistencia (estudiante_id, curso_id, fecha, estado) VALUES (?, ?, ?, ?)
    ON CONFLICT(estudiante_id, curso_id, fecha) DO UPDATE SET estado = excluded.estado
  `);
  const estadoAnterior = db.prepare('SELECT estado FROM asistencia WHERE estudiante_id = ? AND curso_id = ? AND fecha = ?');
  const guardarHistorial = db.prepare(`
    INSERT INTO historial_asistencia
      (estudiante_id, curso_id, salon_id, fecha, estado_anterior, estado_nuevo, motivo, archivo_ruta, archivo_nombre, usuario_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.exec('BEGIN IMMEDIATE');
  try {
    registros.forEach(({ estudianteId, estado, motivo = '', adjuntoLocal }) => {
      const anterior = estadoAnterior.get(estudianteId, salon.curso_id, fecha)?.estado || null;
      guardarAsistencia.run(estudianteId, salon.curso_id, fecha, estado);
      guardarHistorial.run(estudianteId, salon.curso_id, salonId, fecha, anterior, estado, String(motivo).trim(), adjuntoLocal?.ruta || null, adjuntoLocal?.nombre || null, req.actor.id);
      guardarPrediccion(db, estudianteId, salon.curso_id);
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    adjuntos.forEach(eliminarAdjuntoLocal);
    throw error;
  }
  res.status(201).json({ mensaje: `Se guardó la asistencia de ${registros.length} estudiantes.`, registrados: registros.length });
});

app.get('/api/estudiantes', (_req, res) => {
  const { sql, parametros } = filtroVisibilidad(_req.actor);
  res.json(db.prepare(`
    SELECT DISTINCT e.id, u.nombre, e.codigo, e.grado, e.seccion, e.salon_id
    FROM estudiantes e JOIN usuarios u ON u.id = e.usuario_id
    JOIN matriculas m ON m.estudiante_id = e.id
    JOIN cursos c ON c.id = m.curso_id
    WHERE 1 = 1 ${sql}
    ORDER BY u.nombre
  `).all(...parametros));
});

app.get('/api/estudiantes/:estudianteId/cursos', (req, res) => {
  const estudianteId = Number(req.params.estudianteId);
  if (!Number.isInteger(estudianteId)) return res.status(400).json({ error: 'El identificador del estudiante no es válido.' });
  if (!puedeVerEstudiante(db, req.actor, estudianteId)) return res.status(403).json({ error: 'Este perfil no tiene acceso a ese estudiante.' });
  const alcance = filtroVisibilidad(req.actor);
  const cursos = db.prepare(`
    SELECT c.id, c.nombre, c.grado, c.seccion, docente.nombre AS docente
    FROM matriculas m JOIN estudiantes e ON e.id = m.estudiante_id
    JOIN cursos c ON c.id = m.curso_id JOIN usuarios docente ON docente.id = c.docente_id
    WHERE e.id = ? ${alcance.sql}
    ORDER BY CASE c.nombre
      WHEN 'Matemática' THEN 1 WHEN 'Comunicación' THEN 2
      WHEN 'Ciencia y Tecnología' THEN 3 WHEN 'Religión' THEN 4
      WHEN 'Educación por el trabajo' THEN 5 WHEN 'Inglés' THEN 6 ELSE 7 END
  `).all(estudianteId, ...alcance.parametros);
  res.json(cursos);
});

app.get('/api/estudiantes/:estudianteId/ficha', (req, res) => {
  const estudianteId = Number(req.params.estudianteId);
  if (!Number.isInteger(estudianteId)) return res.status(400).json({ error: 'El identificador del estudiante no es válido.' });
  if (!puedeVerEstudiante(db, req.actor, estudianteId)) return res.status(403).json({ error: 'Este perfil no tiene acceso a ese estudiante.' });
  const estudiante = db.prepare(`
    SELECT e.id, e.codigo, e.grado, e.seccion, e.tutor, u.nombre,
           salon.nombre AS salon, tutorUsuario.nombre AS usuario_tutor
    FROM estudiantes e JOIN usuarios u ON u.id = e.usuario_id
    JOIN salones salon ON salon.id = e.salon_id
    LEFT JOIN usuarios tutorUsuario ON tutorUsuario.id = e.tutor_usuario_id
    WHERE e.id = ?
  `).get(estudianteId);
  if (!estudiante) return res.status(404).json({ error: 'No se encontró el estudiante.' });
  const cursos = db.prepare(`
    SELECT c.id, c.nombre, c.docente_id, docente.nombre AS docente,
           ROUND(p.promedio, 1) AS promedio, ROUND(p.asistencia, 1) AS asistencia,
           p.puntaje, p.nivel, p.recomendaciones
    FROM matriculas m JOIN cursos c ON c.id = m.curso_id
    JOIN usuarios docente ON docente.id = c.docente_id
    LEFT JOIN predicciones_riesgo p ON p.estudiante_id = m.estudiante_id AND p.curso_id = m.curso_id
    WHERE m.estudiante_id = ?
    ORDER BY CASE c.nombre
      WHEN 'Matemática' THEN 1 WHEN 'Comunicación' THEN 2
      WHEN 'Ciencia y Tecnología' THEN 3 WHEN 'Religión' THEN 4
      WHEN 'Educación por el trabajo' THEN 5 WHEN 'Inglés' THEN 6 ELSE 7 END
  `).all(estudianteId).map((curso) => ({
    ...curso,
    recomendaciones: JSON.parse(curso.recomendaciones || '[]'),
  }));
  const notas = db.prepare(`
    SELECT n.id, n.fecha, n.evaluacion, n.calificacion, n.entrega_a_tiempo, c.nombre AS curso
    FROM notas n JOIN cursos c ON c.id = n.curso_id
    WHERE n.estudiante_id = ? ORDER BY n.fecha DESC, n.id DESC LIMIT 30
  `).all(estudianteId);
  const asistencias = db.prepare(`
    SELECT a.fecha, a.estado, c.nombre AS curso FROM asistencia a
    JOIN cursos c ON c.id = a.curso_id WHERE a.estudiante_id = ?
    ORDER BY a.fecha DESC, a.id DESC LIMIT 30
  `).all(estudianteId);
  const seguimientos = db.prepare(`
    SELECT f.id, f.tipo, f.resultado, f.nota, f.proximo_contacto, f.registrado_en,
           usuario.nombre AS registrado_por
    FROM seguimientos_familia f JOIN usuarios usuario ON usuario.id = f.usuario_id
    WHERE f.estudiante_id = ? ORDER BY f.registrado_en DESC LIMIT 10
  `).all(estudianteId);
  res.json({ estudiante, cursos, notas, asistencias, seguimientos });
});

app.get('/api/predicciones-riesgo', (req, res) => {
  const filtros = [];
  const parametros = [];
  const alcance = filtroVisibilidad(req.actor);
  if (alcance.sql) {
    filtros.push(alcance.sql.replace(/^ AND /, ''));
    parametros.push(...alcance.parametros);
  }
  if (req.query.estudiante) { filtros.push('e.id = ?'); parametros.push(Number(req.query.estudiante)); }
  if (req.query.curso) { filtros.push('c.id = ?'); parametros.push(Number(req.query.curso)); }
  if (req.query.salon) { filtros.push('sc.salon_id = ?'); parametros.push(Number(req.query.salon)); }
  if (req.query.nivel) { filtros.push('p.nivel = ?'); parametros.push(req.query.nivel); }
  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  const predicciones = db.prepare(`
    SELECT p.id, e.id AS estudiante_id, u.nombre AS estudiante, e.codigo, sc.salon_id,
           c.id AS curso_id, c.nombre AS curso, c.grado, c.seccion,
           ROUND(p.asistencia, 1) AS asistencia, ROUND(p.promedio, 1) AS promedio,
           ROUND(p.entregas_a_tiempo, 0) AS entregas_a_tiempo, p.incidencias,
           p.puntaje, p.nivel, p.recomendaciones, p.actualizada_en,
           (SELECT COUNT(*) FROM asistencia a WHERE a.estudiante_id = p.estudiante_id AND a.curso_id = p.curso_id) AS sesiones,
           (SELECT COUNT(*) FROM asistencia a WHERE a.estudiante_id = p.estudiante_id AND a.curso_id = p.curso_id AND a.estado = 'Ausente') AS ausencias,
           (SELECT COUNT(*) FROM asistencia a WHERE a.estudiante_id = p.estudiante_id AND a.curso_id = p.curso_id AND a.estado = 'Tardanza') AS tardanzas,
           (SELECT COUNT(*) FROM asistencia a WHERE a.estudiante_id = p.estudiante_id AND a.curso_id = p.curso_id AND a.estado = 'Justificado') AS justificados,
           (SELECT valor FROM configuracion_academica WHERE clave = 'tardanzas_por_inasistencia') AS tardanzas_por_inasistencia,
           (SELECT estado FROM asistencia a WHERE a.estudiante_id = p.estudiante_id AND a.curso_id = p.curso_id AND a.fecha = date('now', 'localtime')) AS estado_hoy
    FROM predicciones_riesgo p
    JOIN estudiantes e ON e.id = p.estudiante_id
    JOIN usuarios u ON u.id = e.usuario_id
    JOIN cursos c ON c.id = p.curso_id
    JOIN salon_cursos sc ON sc.curso_id = c.id
    ${where}
    ORDER BY CASE p.nivel WHEN 'Alto' THEN 1 WHEN 'Medio' THEN 2 ELSE 3 END, p.puntaje DESC
  `).all(...parametros).map((fila) => ({
    ...fila,
    recomendaciones: JSON.parse(fila.recomendaciones),
  }));
  res.json(predicciones);
});

app.post('/api/notas', (req, res) => {
  const { estudianteId, cursoId, calificacion, evaluacion, entregaATiempo = true } = req.body;
  if (rechazarSinEdicion(req, res)) return;
  if (![estudianteId, cursoId].every(Number.isInteger) || !Number.isFinite(calificacion) || calificacion < 0 || calificacion > 20 || !String(evaluacion || '').trim()) {
    return res.status(400).json({ error: 'Revisa estudiante, curso, evaluación y nota (0 a 20).' });
  }
  const curso = db.prepare('SELECT docente_id FROM cursos WHERE id = ?').get(cursoId);
  const matricula = db.prepare('SELECT 1 FROM matriculas WHERE estudiante_id = ? AND curso_id = ?').get(estudianteId, cursoId);
  if (!puedeVerEstudiante(db, req.actor, estudianteId) || !matricula || (req.actor.rol === 'Docente' && curso?.docente_id !== req.actor.id)) {
    return res.status(403).json({ error: 'Este perfil no puede registrar notas para ese estudiante/curso.' });
  }
  try {
    const fecha = fechaLocal();
    db.prepare(`INSERT INTO notas (estudiante_id, curso_id, calificacion, evaluacion, entrega_a_tiempo, fecha) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(estudianteId, cursoId, calificacion, String(evaluacion).trim(), entregaATiempo ? 1 : 0, fecha);
    const prediccion = guardarPrediccion(db, estudianteId, cursoId);
    res.status(201).json({ mensaje: 'Nota registrada y riesgo recalculado.', prediccion });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') return res.status(404).json({ error: 'No se encontró el estudiante o el curso.' });
    throw error;
  }
});

app.post('/api/asistencia', (req, res) => {
  const { estudianteId, cursoId, fecha, estado, motivo = '' } = req.body;
  const estadosValidos = ['Presente', 'Tardanza', 'Ausente', 'Justificado'];
  if (rechazarSinEdicion(req, res)) return;
  if (![estudianteId, cursoId].every(Number.isInteger) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha || '') || !estadosValidos.includes(estado) || String(motivo).length > 500 || (estado === 'Justificado' && String(motivo).trim().length < 3)) {
    return res.status(400).json({ error: 'Revisa estudiante, curso, fecha y estado de asistencia.' });
  }
  const salon = db.prepare('SELECT id FROM salones WHERE curso_id = ?').get(cursoId);
  const curso = db.prepare('SELECT docente_id FROM cursos WHERE id = ?').get(cursoId);
  const matricula = db.prepare('SELECT 1 FROM matriculas WHERE estudiante_id = ? AND curso_id = ?').get(estudianteId, cursoId);
  if (!salon || !matricula || !puedeVerSalon(db, req.actor, salon.id) || (req.actor.rol === 'Docente' && curso?.docente_id !== req.actor.id)) {
    return res.status(403).json({ error: 'Este perfil no puede registrar asistencia en ese curso.' });
  }
  try {
    db.exec('BEGIN IMMEDIATE');
    const anterior = db.prepare('SELECT estado FROM asistencia WHERE estudiante_id = ? AND curso_id = ? AND fecha = ?').get(estudianteId, cursoId, fecha)?.estado || null;
    db.prepare(`
      INSERT INTO asistencia (estudiante_id, curso_id, fecha, estado) VALUES (?, ?, ?, ?)
      ON CONFLICT(estudiante_id, curso_id, fecha) DO UPDATE SET estado = excluded.estado
    `).run(estudianteId, cursoId, fecha, estado);
    db.prepare(`
      INSERT INTO historial_asistencia (estudiante_id, curso_id, salon_id, fecha, estado_anterior, estado_nuevo, motivo, usuario_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(estudianteId, cursoId, salon.id, fecha, anterior, estado, String(motivo).trim(), req.actor.id);
    const prediccion = guardarPrediccion(db, estudianteId, cursoId);
    db.exec('COMMIT');
    res.status(201).json({ mensaje: 'Asistencia registrada y riesgo recalculado.', prediccion });
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') return res.status(404).json({ error: 'No se encontró el estudiante o el curso.' });
    throw error;
  }
});

registrarRutasSeguimiento(app, db, carpetaJustificaciones);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Ocurrió un error en el servidor local.' });
});

app.listen(puerto, '127.0.0.1', () => {
  console.log(`API académica local: http://127.0.0.1:${puerto}`);
});
