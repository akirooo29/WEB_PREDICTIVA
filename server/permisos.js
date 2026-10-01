export function esAdministrador(actor) {
  return actor?.rol === 'Administrador';
}

export function puedeEditarAcademico(actor) {
  return esAdministrador(actor) || actor?.rol === 'Docente';
}

export function puedeVerSalon(db, actor, salonId) {
  if (esAdministrador(actor)) return true;
  if (actor?.rol === 'Docente') {
    return Boolean(db.prepare(`
      SELECT 1 FROM salones s JOIN cursos c ON c.id = s.curso_id
      WHERE s.id = ? AND c.docente_id = ?
    `).get(salonId, actor.id));
  }
  if (actor?.rol === 'Estudiante/Tutor') {
    return Boolean(db.prepare('SELECT 1 FROM estudiantes WHERE salon_id = ? AND tutor_usuario_id = ?').get(salonId, actor.id));
  }
  return false;
}

export function puedeVerEstudiante(db, actor, estudianteId) {
  if (esAdministrador(actor)) return true;
  if (actor?.rol === 'Estudiante/Tutor') {
    return Boolean(db.prepare('SELECT 1 FROM estudiantes WHERE id = ? AND tutor_usuario_id = ?').get(estudianteId, actor.id));
  }
  if (actor?.rol === 'Docente') {
    return Boolean(db.prepare(`
      SELECT 1 FROM matriculas m JOIN cursos c ON c.id = m.curso_id
      WHERE m.estudiante_id = ? AND c.docente_id = ?
    `).get(estudianteId, actor.id));
  }
  return false;
}

export function filtroVisibilidad(actor, aliasEstudiante = 'e', aliasCurso = 'c') {
  if (actor?.rol === 'Administrador') return { sql: '', parametros: [] };
  if (actor?.rol === 'Docente') return { sql: ` AND ${aliasCurso}.docente_id = ?`, parametros: [actor.id] };
  return { sql: ` AND ${aliasEstudiante}.tutor_usuario_id = ?`, parametros: [actor.id] };
}
