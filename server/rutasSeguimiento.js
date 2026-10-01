import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { esAdministrador, filtroVisibilidad, puedeEditarAcademico, puedeVerEstudiante } from './permisos.js';
import { guardarPrediccion } from './modeloRiesgo.js';

const tiposContacto = ['Llamada', 'Mensaje', 'Reunión', 'Observación'];
const estadosContacto = ['Pendiente', 'Completado'];
const esFecha = (fecha) => /^\d{4}-\d{2}-\d{2}$/.test(fecha || '') && !Number.isNaN(Date.parse(`${fecha}T12:00:00`));

function alcanceSql(actor, aliasEstudiante = 'e', aliasCurso = 'c') {
  const alcance = filtroVisibilidad(actor, aliasEstudiante, aliasCurso);
  return { sql: alcance.sql ? alcance.sql.replace(/^ AND /, '') : '', parametros: alcance.parametros };
}

function datosExportacion(tipo, db, actor) {
  const alcance = alcanceSql(actor, 'e', 'c');
  const condiciones = alcance.sql ? [alcance.sql] : ['1 = 1'];
  const parametros = [...alcance.parametros];
  if (tipo === 'alumnos') {
    return {
      titulo: 'Matrícula de alumnos',
      cabeceras: ['Código', 'Estudiante', 'Grado', 'Sección', 'Salón', 'Tutor'],
      filas: db.prepare(`
        SELECT e.codigo, u.nombre AS estudiante, e.grado, e.seccion, s.nombre AS salon, tutor.nombre AS tutor
        FROM estudiantes e JOIN usuarios u ON u.id = e.usuario_id
        JOIN salones s ON s.id = e.salon_id LEFT JOIN usuarios tutor ON tutor.id = e.tutor_usuario_id
        LEFT JOIN matriculas m ON m.estudiante_id = e.id LEFT JOIN cursos c ON c.id = m.curso_id
        WHERE ${condiciones.join(' AND ')} GROUP BY e.id ORDER BY s.nombre, u.nombre
      `).all(...parametros).map((fila) => [fila.codigo, fila.estudiante, fila.grado, fila.seccion, fila.salon, fila.tutor]),
    };
  }
  if (tipo === 'notas') {
    return {
      titulo: 'Notas por curso',
      cabeceras: ['Código', 'Estudiante', 'Salón', 'Curso', 'Fecha', 'Evaluación', 'Calificación', 'Entrega a tiempo'],
      filas: db.prepare(`
        SELECT e.codigo, u.nombre AS estudiante, s.nombre AS salon, c.nombre AS curso,
               n.fecha, n.evaluacion, n.calificacion, n.entrega_a_tiempo
        FROM notas n JOIN estudiantes e ON e.id = n.estudiante_id
        JOIN usuarios u ON u.id = e.usuario_id JOIN cursos c ON c.id = n.curso_id
        JOIN salones s ON s.id = e.salon_id
        WHERE ${condiciones.join(' AND ')} ORDER BY s.nombre, u.nombre, c.nombre, n.fecha
      `).all(...parametros).map((fila) => [fila.codigo, fila.estudiante, fila.salon, fila.curso, fila.fecha, fila.evaluacion, fila.calificacion, fila.entrega_a_tiempo ? 'Sí' : 'No']),
    };
  }
  if (tipo === 'asistencia') {
    return {
      titulo: 'Asistencia diaria',
      cabeceras: ['Código', 'Estudiante', 'Salón', 'Curso', 'Fecha', 'Estado'],
      filas: db.prepare(`
        SELECT e.codigo, u.nombre AS estudiante, s.nombre AS salon, c.nombre AS curso, a.fecha, a.estado
        FROM asistencia a JOIN estudiantes e ON e.id = a.estudiante_id
        JOIN usuarios u ON u.id = e.usuario_id JOIN cursos c ON c.id = a.curso_id
        JOIN salones s ON s.id = e.salon_id
        WHERE ${condiciones.join(' AND ')} ORDER BY s.nombre, a.fecha DESC, u.nombre
      `).all(...parametros).map((fila) => [fila.codigo, fila.estudiante, fila.salon, fila.curso, fila.fecha, fila.estado]),
    };
  }
  return null;
}

export function registrarRutasSeguimiento(app, db, carpetaJustificaciones) {
  app.get('/api/plantillas/notas.csv', (_req, res) => {
    const plantilla = '\uFEFFcodigo,curso,calificacion,evaluacion,fecha,entregaATiempo\r\nAN-2026-001,Matemática,14,Práctica de ejemplo,2026-09-30,true\r\n';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla-notas.csv"');
    res.send(plantilla);
  });

  app.get('/api/exportaciones/:tipo.pdf', async (req, res, next) => {
    try {
      const datos = datosExportacion(req.params.tipo, db, req.actor);
      if (!datos) return res.status(404).json({ error: 'Elige un conjunto válido: alumnos, notas o asistencia.' });
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'), import('jspdf-autotable'),
      ]);
      const documento = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      documento.setProperties({ title: datos.titulo, subject: 'Respaldo académico local', author: 'Aula Norte' });
      documento.setFont('helvetica', 'bold');
      documento.setFontSize(16);
      documento.text(datos.titulo, 14, 16);
      documento.setFont('helvetica', 'normal');
      documento.setFontSize(9);
      documento.text(`Generado: ${new Date().toLocaleString('es-PE')}  |  Registros: ${datos.filas.length}`, 14, 23);
      autoTable(documento, {
        startY: 28,
        head: [datos.cabeceras],
        body: datos.filas,
        margin: { left: 14, right: 14, bottom: 14 },
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.2, overflow: 'linebreak' },
        headStyles: { fillColor: [22, 125, 98], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [244, 247, 244] },
        didDrawPage: () => {
          documento.setFontSize(8);
          documento.setTextColor(110);
          documento.text(`Aula Norte · ${datos.filas.length} registros`, 14, documento.internal.pageSize.height - 7);
        },
      });
      const pdf = Buffer.from(documento.output('arraybuffer'));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.tipo}-academico.pdf"`);
      res.setHeader('Content-Length', pdf.length);
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/importaciones/notas', express.text({ type: ['text/csv', 'text/plain'], limit: '2mb' }), (req, res) => {
    if (!puedeEditarAcademico(req.actor)) return res.status(403).json({ error: 'Este perfil no puede importar notas.' });
    if (typeof req.body !== 'string' || !req.body.trim()) return res.status(400).json({ error: 'Selecciona un archivo CSV con notas.' });
    let filas;
    try {
      filas = parse(req.body, { columns: true, bom: true, skip_empty_lines: true, trim: true, max_record_size: 10000 });
    } catch (error) {
      return res.status(400).json({ error: `No se pudo leer el CSV: ${error.message}` });
    }
    if (!filas.length || filas.length > 1000) return res.status(400).json({ error: 'El archivo debe incluir entre 1 y 1000 notas.' });
    const campos = ['codigo', 'curso', 'calificacion', 'evaluacion', 'fecha'];
    if (campos.some((campo) => !Object.hasOwn(filas[0], campo))) {
      return res.status(400).json({ error: `El CSV debe incluir las columnas: ${[...campos, 'entregaATiempo'].join(', ')}.` });
    }
    const errores = [];
    const preparadas = [];
    filas.forEach((fila, indice) => {
      const linea = indice + 2;
      const nota = Number(fila.calificacion);
      if (!fila.codigo || !fila.curso || !fila.evaluacion || !esFecha(fila.fecha) || !Number.isFinite(nota) || nota < 0 || nota > 20) {
        errores.push(`Línea ${linea}: revisa código, curso, evaluación, fecha y calificación (0–20).`);
        return;
      }
      const entrega = String(fila.entregaATiempo || 'true').toLocaleLowerCase();
      if (!['true', 'false', '1', '0', 'si', 'sí', 'no'].includes(entrega)) {
        errores.push(`Línea ${linea}: entregaATiempo debe ser true/false, 1/0 o sí/no.`);
        return;
      }
      const estudiante = db.prepare(`
        SELECT e.id, e.salon_id FROM estudiantes e WHERE e.codigo = ?
      `).get(fila.codigo);
      if (!estudiante) { errores.push(`Línea ${linea}: no existe el código ${fila.codigo}.`); return; }
      const curso = db.prepare(`
        SELECT c.id, c.docente_id FROM cursos c JOIN matriculas m ON m.curso_id = c.id
        WHERE m.estudiante_id = ? AND lower(c.nombre) = lower(?) LIMIT 1
      `).get(estudiante.id, fila.curso);
      if (!curso) { errores.push(`Línea ${linea}: ${fila.codigo} no está matriculado en ${fila.curso}.`); return; }
      if (!puedeVerEstudiante(db, req.actor, estudiante.id) || (req.actor.rol === 'Docente' && curso.docente_id !== req.actor.id)) {
        errores.push(`Línea ${linea}: tu perfil no tiene acceso a ${fila.codigo} / ${fila.curso}.`);
        return;
      }
      const duplicada = db.prepare(`
        SELECT 1 FROM notas WHERE estudiante_id = ? AND curso_id = ? AND fecha = ? AND evaluacion = ?
      `).get(estudiante.id, curso.id, fila.fecha, fila.evaluacion);
      if (duplicada) { errores.push(`Línea ${linea}: ya existe esa evaluación para ${fila.codigo} en ${fila.fecha}.`); return; }
      preparadas.push({ estudianteId: estudiante.id, cursoId: curso.id, nota, evaluacion: fila.evaluacion, fecha: fila.fecha, entrega: ['false', '0', 'no'].includes(entrega) ? 0 : 1 });
    });
    if (errores.length) return res.status(400).json({ error: 'No se importó ninguna fila. Corrige los errores indicados.', errores });

    const insertar = db.prepare(`
      INSERT INTO notas (estudiante_id, curso_id, calificacion, evaluacion, entrega_a_tiempo, fecha)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    db.exec('BEGIN IMMEDIATE');
    try {
      preparadas.forEach((fila) => {
        insertar.run(fila.estudianteId, fila.cursoId, fila.nota, fila.evaluacion, fila.entrega, fila.fecha);
        guardarPrediccion(db, fila.estudianteId, fila.cursoId);
      });
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    res.status(201).json({ mensaje: `Se importaron ${preparadas.length} notas.`, importadas: preparadas.length });
  });

  app.get('/api/configuracion/asistencia', (_req, res) => {
    const valor = Number(db.prepare(`SELECT valor FROM configuracion_academica WHERE clave = 'tardanzas_por_inasistencia'`).get()?.valor) || 3;
    res.json({ tardanzasPorInasistencia: valor });
  });

  app.put('/api/configuracion/asistencia', (req, res) => {
    if (!esAdministrador(req.actor)) return res.status(403).json({ error: 'Solo administración puede modificar esta regla.' });
    const { tardanzasPorInasistencia } = req.body;
    if (!Number.isInteger(tardanzasPorInasistencia) || tardanzasPorInasistencia < 2 || tardanzasPorInasistencia > 10) {
      return res.status(400).json({ error: 'El umbral debe ser un número entero entre 2 y 10.' });
    }
    db.prepare(`
      INSERT INTO configuracion_academica (clave, valor, actualizado_por, actualizado_en)
      VALUES ('tardanzas_por_inasistencia', ?, ?, datetime('now', 'localtime'))
      ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_por = excluded.actualizado_por, actualizado_en = excluded.actualizado_en
    `).run(String(tardanzasPorInasistencia), req.actor.id);
    db.prepare('SELECT estudiante_id, curso_id FROM matriculas').all()
      .forEach(({ estudiante_id, curso_id }) => guardarPrediccion(db, estudiante_id, curso_id));
    res.json({ mensaje: 'Regla de tardanzas actualizada.', tardanzasPorInasistencia });
  });

  app.get('/api/historial-asistencia', (req, res) => {
    const condiciones = ['1 = 1'];
    const parametros = [];
    const { desde, hasta, salonId, estudianteId } = req.query;
    if (desde && !esFecha(desde) || hasta && !esFecha(hasta)) return res.status(400).json({ error: 'Usa fechas válidas con formato AAAA-MM-DD.' });
    if (desde) { condiciones.push('h.fecha >= ?'); parametros.push(desde); }
    if (hasta) { condiciones.push('h.fecha <= ?'); parametros.push(hasta); }
    if (salonId) { condiciones.push('h.salon_id = ?'); parametros.push(Number(salonId)); }
    if (estudianteId) { condiciones.push('h.estudiante_id = ?'); parametros.push(Number(estudianteId)); }
    const alcance = alcanceSql(req.actor);
    if (alcance.sql) { condiciones.push(alcance.sql); parametros.push(...alcance.parametros); }
    const historial = db.prepare(`
      SELECT h.id, h.fecha, h.estado_anterior, h.estado_nuevo, h.motivo,
             h.archivo_nombre, h.archivo_ruta IS NOT NULL AS tiene_archivo,
             h.registrado_en, e.id AS estudiante_id, e.codigo, u.nombre AS estudiante,
             s.nombre AS salon, actor.nombre AS registrado_por
      FROM historial_asistencia h
      JOIN estudiantes e ON e.id = h.estudiante_id JOIN usuarios u ON u.id = e.usuario_id
      JOIN cursos c ON c.id = h.curso_id JOIN salones s ON s.id = h.salon_id
      JOIN usuarios actor ON actor.id = h.usuario_id
      WHERE ${condiciones.join(' AND ')}
      ORDER BY h.fecha DESC, h.id DESC LIMIT 500
    `).all(...parametros);
    res.json(historial);
  });

  app.get('/api/historial-asistencia/:id/archivo', (req, res) => {
    const cambio = db.prepare('SELECT estudiante_id, archivo_ruta, archivo_nombre FROM historial_asistencia WHERE id = ?').get(Number(req.params.id));
    if (!cambio?.archivo_ruta) return res.status(404).json({ error: 'No hay un archivo asociado a este registro.' });
    if (!puedeVerEstudiante(db, req.actor, cambio.estudiante_id)) return res.status(403).json({ error: 'Este perfil no puede acceder al archivo.' });
    const ruta = join(carpetaJustificaciones, cambio.archivo_ruta);
    if (!existsSync(ruta)) return res.status(404).json({ error: 'El archivo ya no existe en el almacenamiento local.' });
    res.download(ruta, cambio.archivo_nombre);
  });

  app.get('/api/reportes/historial.pdf', async (req, res, next) => {
    try {
      const { desde, hasta, salonId, estudianteId } = req.query;
      if (!esFecha(desde) || !esFecha(hasta) || desde > hasta) {
        return res.status(400).json({ error: 'Indica un rango válido: desde y hasta (AAAA-MM-DD).' });
      }
      const condiciones = ['h.fecha >= ?', 'h.fecha <= ?'];
      const parametros = [desde, hasta];
      if (salonId) {
        const id = Number(salonId);
        if (!Number.isInteger(id)) return res.status(400).json({ error: 'El salón del reporte no es válido.' });
        condiciones.push('h.salon_id = ?');
        parametros.push(id);
      }
      if (estudianteId) {
        const id = Number(estudianteId);
        if (!Number.isInteger(id)) return res.status(400).json({ error: 'El estudiante del reporte no es válido.' });
        condiciones.push('h.estudiante_id = ?');
        parametros.push(id);
      }
      const alcance = alcanceSql(req.actor);
      if (alcance.sql) { condiciones.push(alcance.sql); parametros.push(...alcance.parametros); }
      const filas = db.prepare(`
        SELECT h.fecha, h.estado_anterior, h.estado_nuevo, h.motivo, h.archivo_nombre,
               h.registrado_en, e.codigo, u.nombre AS estudiante, s.nombre AS salon,
               actor.nombre AS registrado_por
        FROM historial_asistencia h
        JOIN estudiantes e ON e.id = h.estudiante_id JOIN usuarios u ON u.id = e.usuario_id
        JOIN cursos c ON c.id = h.curso_id JOIN salones s ON s.id = h.salon_id
        JOIN usuarios actor ON actor.id = h.usuario_id
        WHERE ${condiciones.join(' AND ')} ORDER BY h.fecha DESC, h.id DESC LIMIT 500
      `).all(...parametros);
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'), import('jspdf-autotable'),
      ]);
      const documento = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const salon = salonId ? db.prepare('SELECT nombre FROM salones WHERE id = ?').get(Number(salonId))?.nombre || 'Salón' : 'Todos los salones';
      documento.setProperties({ title: 'Historial de asistencia', subject: 'Reporte académico local', author: 'Aula Norte' });
      documento.setFont('helvetica', 'bold');
      documento.setFontSize(16);
      documento.text('Historial de asistencia', 14, 16);
      documento.setFont('helvetica', 'normal');
      documento.setFontSize(9);
      documento.text(`Período: ${desde} a ${hasta}  |  Salón: ${salon}`, 14, 23);
      autoTable(documento, {
        startY: 28,
        head: [['Fecha / hora', 'Estudiante', 'Salón', 'Cambio', 'Motivo', 'Registró', 'Adjunto']],
        body: filas.map((fila) => [
          `${fila.fecha} ${fila.registrado_en.slice(11, 16)}`,
          `${fila.estudiante} (${fila.codigo})`,
          fila.salon,
          `De ${fila.estado_anterior || 'Sin registro'} a ${fila.estado_nuevo}`,
          fila.motivo || 'Sin motivo',
          fila.registrado_por,
          fila.archivo_nombre || '—',
        ]),
        margin: { left: 14, right: 14, bottom: 14 },
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.2, overflow: 'linebreak' },
        headStyles: { fillColor: [22, 125, 98], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [244, 247, 244] },
        didDrawPage: () => {
          documento.setFontSize(8);
          documento.setTextColor(110);
          documento.text(`Aula Norte · ${filas.length} eventos`, 14, documento.internal.pageSize.height - 7);
        },
      });
      const pdf = Buffer.from(documento.output('arraybuffer'));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="historial-asistencia-${desde}-${hasta}.pdf"`);
      res.setHeader('Content-Length', pdf.length);
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/seguimientos-familia', (req, res) => {
    const condiciones = ['1 = 1'];
    const parametros = [];
    if (req.query.estudianteId) { condiciones.push('e.id = ?'); parametros.push(Number(req.query.estudianteId)); }
    const alcance = alcanceSql(req.actor);
    if (alcance.sql) { condiciones.push(alcance.sql); parametros.push(...alcance.parametros); }
    res.json(db.prepare(`
      SELECT f.id, f.estudiante_id, u.nombre AS estudiante, e.codigo, f.tipo, f.resultado,
             f.nota, f.proximo_contacto, f.registrado_en, actor.nombre AS registrado_por
      FROM seguimientos_familia f JOIN estudiantes e ON e.id = f.estudiante_id
      JOIN usuarios u ON u.id = e.usuario_id JOIN cursos c ON c.id = (
        SELECT m.curso_id FROM matriculas m WHERE m.estudiante_id = e.id LIMIT 1
      ) JOIN usuarios actor ON actor.id = f.usuario_id
      WHERE ${condiciones.join(' AND ')} ORDER BY f.registrado_en DESC LIMIT 200
    `).all(...parametros));
  });

  app.post('/api/seguimientos-familia', (req, res) => {
    if (!puedeEditarAcademico(req.actor)) return res.status(403).json({ error: 'Este perfil no puede registrar seguimientos.' });
    const { estudianteId, tipo, resultado, nota, proximoContacto } = req.body;
    if (!Number.isInteger(estudianteId) || !tiposContacto.includes(tipo) || !estadosContacto.includes(resultado) || !String(nota || '').trim() || (proximoContacto && !esFecha(proximoContacto))) {
      return res.status(400).json({ error: 'Revisa estudiante, tipo, estado, nota y fecha del próximo contacto.' });
    }
    if (!puedeVerEstudiante(db, req.actor, estudianteId)) return res.status(403).json({ error: 'Este perfil no tiene acceso a ese estudiante.' });
    const insercion = db.prepare(`
      INSERT INTO seguimientos_familia (estudiante_id, tipo, resultado, nota, proximo_contacto, usuario_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(estudianteId, tipo, resultado, String(nota).trim().slice(0, 1000), proximoContacto || null, req.actor.id);
    res.status(201).json({ id: Number(insercion.lastInsertRowid), mensaje: 'Seguimiento familiar registrado.' });
  });
}
