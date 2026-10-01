import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { guardarPrediccion } from './modeloRiesgo.js';

const carpetaDatos = join(dirname(fileURLToPath(import.meta.url)), 'data');
mkdirSync(carpetaDatos, { recursive: true });
export { carpetaDatos };
export const db = new DatabaseSync(join(carpetaDatos, 'academico.db'));
db.exec('PRAGMA foreign_keys = ON;');

const fechaLocal = (fecha) => `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
const salonesIniciales = [
  { id: 1, nombre: '5.º A', grado: '5.º', seccion: 'A', cursoId: 1 },
  { id: 2, nombre: '5.º B', grado: '5.º', seccion: 'B', cursoId: 2 },
  { id: 3, nombre: '5.º C', grado: '5.º', seccion: 'C', cursoId: 3 },
];
const cursosDelSalon = ['Matemática', 'Comunicación', 'Ciencia y Tecnología', 'Religión', 'Educación por el trabajo', 'Inglés'];

db.exec(`
  CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE
  );
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL,
    correo TEXT NOT NULL UNIQUE,
    rol_id INTEGER NOT NULL REFERENCES roles(id),
    activo INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS estudiantes (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER NOT NULL UNIQUE REFERENCES usuarios(id),
    codigo TEXT NOT NULL UNIQUE,
    grado TEXT NOT NULL,
    seccion TEXT NOT NULL,
    tutor TEXT NOT NULL,
    salon_id INTEGER REFERENCES salones(id),
    tutor_usuario_id INTEGER REFERENCES usuarios(id)
  );
  CREATE TABLE IF NOT EXISTS cursos (
    id INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL,
    grado TEXT NOT NULL,
    seccion TEXT NOT NULL,
    docente_id INTEGER NOT NULL REFERENCES usuarios(id)
  );
  CREATE TABLE IF NOT EXISTS salones (
    id INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    grado TEXT NOT NULL,
    seccion TEXT NOT NULL,
    curso_id INTEGER NOT NULL UNIQUE REFERENCES cursos(id)
  );
  CREATE TABLE IF NOT EXISTS salon_cursos (
    salon_id INTEGER NOT NULL REFERENCES salones(id),
    curso_id INTEGER NOT NULL UNIQUE REFERENCES cursos(id),
    PRIMARY KEY (salon_id, curso_id)
  );
  CREATE TABLE IF NOT EXISTS matriculas (
    estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id),
    curso_id INTEGER NOT NULL REFERENCES cursos(id),
    PRIMARY KEY (estudiante_id, curso_id)
  );
  CREATE TABLE IF NOT EXISTS notas (
    id INTEGER PRIMARY KEY,
    estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id),
    curso_id INTEGER NOT NULL REFERENCES cursos(id),
    calificacion REAL NOT NULL CHECK (calificacion BETWEEN 0 AND 20),
    evaluacion TEXT NOT NULL,
    entrega_a_tiempo INTEGER NOT NULL DEFAULT 1,
    fecha TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS asistencia (
    id INTEGER PRIMARY KEY,
    estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id),
    curso_id INTEGER NOT NULL REFERENCES cursos(id),
    fecha TEXT NOT NULL,
    estado TEXT NOT NULL CHECK (estado IN ('Presente', 'Tardanza', 'Ausente', 'Justificado')),
    UNIQUE (estudiante_id, curso_id, fecha)
  );
  CREATE TABLE IF NOT EXISTS historial_asistencia (
    id INTEGER PRIMARY KEY,
    estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id),
    curso_id INTEGER NOT NULL REFERENCES cursos(id),
    salon_id INTEGER NOT NULL REFERENCES salones(id),
    fecha TEXT NOT NULL,
    estado_anterior TEXT,
    estado_nuevo TEXT NOT NULL,
    motivo TEXT NOT NULL DEFAULT '',
    archivo_ruta TEXT,
    archivo_nombre TEXT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    registrado_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
  CREATE TABLE IF NOT EXISTS configuracion_academica (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    actualizado_por INTEGER REFERENCES usuarios(id),
    actualizado_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
  CREATE TABLE IF NOT EXISTS seguimientos_familia (
    id INTEGER PRIMARY KEY,
    estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id),
    tipo TEXT NOT NULL CHECK (tipo IN ('Llamada', 'Mensaje', 'Reunión', 'Observación')),
    resultado TEXT NOT NULL CHECK (resultado IN ('Pendiente', 'Completado')),
    nota TEXT NOT NULL,
    proximo_contacto TEXT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    registrado_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
  CREATE TABLE IF NOT EXISTS conductas (
    id INTEGER PRIMARY KEY,
    estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id),
    curso_id INTEGER REFERENCES cursos(id),
    descripcion TEXT NOT NULL,
    fecha TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS predicciones_riesgo (
    id INTEGER PRIMARY KEY,
    estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id),
    curso_id INTEGER NOT NULL REFERENCES cursos(id),
    asistencia REAL NOT NULL,
    promedio REAL NOT NULL,
    entregas_a_tiempo REAL NOT NULL,
    incidencias INTEGER NOT NULL,
    puntaje INTEGER NOT NULL,
    nivel TEXT NOT NULL CHECK (nivel IN ('Alto', 'Medio', 'Bajo')),
    recomendaciones TEXT NOT NULL,
    actualizada_en TEXT NOT NULL,
    UNIQUE (estudiante_id, curso_id)
  );
`);

const columnasEstudiante = db.prepare('PRAGMA table_info(estudiantes)').all();
if (!columnasEstudiante.some((columna) => columna.name === 'salon_id')) {
  db.exec('ALTER TABLE estudiantes ADD COLUMN salon_id INTEGER REFERENCES salones(id)');
}
if (!columnasEstudiante.some((columna) => columna.name === 'tutor_usuario_id')) {
  db.exec('ALTER TABLE estudiantes ADD COLUMN tutor_usuario_id INTEGER REFERENCES usuarios(id)');
}

const cantidadUsuarios = db.prepare('SELECT COUNT(*) AS total FROM usuarios').get().total;
if (cantidadUsuarios === 0) inicializarDatos();
inicializarSalones();
normalizarGradosYSecciones();
asegurarCursosPorSalon();
completarMatriculaPorSalon();
completarCursosDeEstudiantes();
inicializarVinculosTutores();
db.prepare(`INSERT OR IGNORE INTO configuracion_academica (clave, valor) VALUES ('tardanzas_por_inasistencia', '3')`).run();
db.prepare('SELECT estudiante_id, curso_id FROM matriculas').all()
  .forEach(({ estudiante_id, curso_id }) => guardarPrediccion(db, estudiante_id, curso_id));
sembrarHistorialInicial();
sembrarSeguimientosFamiliares();

function inicializarSalones() {
  const insertarSalon = db.prepare(`
    INSERT OR IGNORE INTO salones (id, nombre, grado, seccion, curso_id) VALUES (?, ?, ?, ?, ?)
  `);
  const actualizarSalon = db.prepare('UPDATE salones SET nombre = ?, grado = ?, seccion = ?, curso_id = ? WHERE id = ?');
  salonesIniciales.forEach((salon) => insertarSalon.run(salon.id, salon.nombre, salon.grado, salon.seccion, salon.cursoId));
  salonesIniciales.forEach((salon) => actualizarSalon.run(salon.nombre, salon.grado, salon.seccion, salon.cursoId, salon.id));
  db.prepare(`
    UPDATE estudiantes SET salon_id = (
      SELECT s.id FROM matriculas m JOIN salones s ON s.curso_id = m.curso_id
      WHERE m.estudiante_id = estudiantes.id LIMIT 1
    ) WHERE salon_id IS NULL
  `).run();
}

function normalizarGradosYSecciones() {
  const actualizarCursoPrincipal = db.prepare(`
    UPDATE cursos SET nombre = ?, grado = ?, seccion = ?, docente_id = ? WHERE id = ?
  `);
  const actualizarEstudiante = db.prepare(`
    UPDATE estudiantes SET grado = '5.º', seccion = (
      SELECT seccion FROM salones WHERE id = estudiantes.salon_id
    ) WHERE salon_id IS NOT NULL
  `);
  salonesIniciales.forEach((salon) => actualizarCursoPrincipal.run(
    cursosDelSalon[0], salon.grado, salon.seccion, salon.seccion === 'B' ? 3 : 2, salon.cursoId,
  ));
  actualizarEstudiante.run();
}

function asegurarCursosPorSalon() {
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_cursos_grado_seccion_nombre ON cursos (grado, seccion, nombre)');
  const insertarCurso = db.prepare(`
    INSERT OR IGNORE INTO cursos (nombre, grado, seccion, docente_id) VALUES (?, ?, ?, ?)
  `);
  const buscarCurso = db.prepare('SELECT id FROM cursos WHERE grado = ? AND seccion = ? AND nombre = ?');
  const enlazarCurso = db.prepare('INSERT OR IGNORE INTO salon_cursos (salon_id, curso_id) VALUES (?, ?)');
  salonesIniciales.forEach((salon) => {
    for (const nombre of cursosDelSalon) {
      insertarCurso.run(nombre, salon.grado, salon.seccion, salon.seccion === 'B' ? 3 : 2);
      const curso = buscarCurso.get(salon.grado, salon.seccion, nombre);
      enlazarCurso.run(salon.id, curso.id);
    }
  });
}

function completarMatriculaPorSalon() {
  const primerNombre = ['Sofía', 'Mateo', 'Valentina', 'Thiago', 'Camila', 'Sebastián', 'Luciana', 'Gael', 'Daniela', 'Nicolás', 'Mía', 'Samuel', 'Renata', 'Joaquín', 'Alessia', 'Adrián', 'Emilia', 'Bruno', 'Ariana', 'Dylan'];
  const apellidos = ['Vargas', 'Mendoza', 'Rojas', 'Castillo', 'Paredes', 'Flores', 'Ruiz', 'Castañeda', 'Salazar', 'Vera', 'León', 'Campos', 'Navarro', 'Reyes', 'Aguilar', 'Guzmán', 'Herrera', 'Valdivia', 'Torres', 'Cruz'];
  const perfiles = [
    { notas: [16, 15, 17], asistencia: 90, entregas: 1, conducta: 0 },
    { notas: [12, 13, 11], asistencia: 80, entregas: 0.67, conducta: 1 },
    { notas: [9, 10, 8], asistencia: 70, entregas: 0.67, conducta: 2 },
    { notas: [6, 8, 7], asistencia: 50, entregas: 0.33, conducta: 5 },
  ];
  const insertarUsuario = db.prepare('INSERT INTO usuarios (nombre, correo, rol_id) VALUES (?, ?, 3)');
  const insertarEstudiante = db.prepare(`
    INSERT INTO estudiantes (usuario_id, codigo, grado, seccion, tutor, salon_id) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertarMatricula = db.prepare('INSERT INTO matriculas (estudiante_id, curso_id) VALUES (?, ?)');
  const insertarNota = db.prepare('INSERT INTO notas (estudiante_id, curso_id, calificacion, evaluacion, entrega_a_tiempo, fecha) VALUES (?, ?, ?, ?, ?, ?)');
  const insertarAsistencia = db.prepare('INSERT INTO asistencia (estudiante_id, curso_id, fecha, estado) VALUES (?, ?, ?, ?)');
  const insertarConducta = db.prepare('INSERT INTO conductas (estudiante_id, curso_id, descripcion, fecha) VALUES (?, ?, ?, ?)');
  let estudianteId = Number(db.prepare('SELECT COALESCE(MAX(id), 0) AS total FROM estudiantes').get().total);
  let usuarioId = Number(db.prepare('SELECT COALESCE(MAX(id), 0) AS total FROM usuarios').get().total);
  let indiceNombre = 0;

  db.exec('BEGIN IMMEDIATE');
  try {
    for (const salon of salonesIniciales) {
      const matriculados = Number(db.prepare('SELECT COUNT(*) AS total FROM estudiantes WHERE salon_id = ?').get(salon.id).total);
      for (let puesto = matriculados; puesto < 20; puesto += 1) {
        estudianteId += 1;
        usuarioId += 1;
        const nombre = `${primerNombre[indiceNombre % primerNombre.length]} ${apellidos[indiceNombre % apellidos.length]} ${apellidos[Math.floor(indiceNombre / apellidos.length) % apellidos.length]}`;
        const perfil = perfiles[indiceNombre % perfiles.length];
        indiceNombre += 1;
        insertarUsuario.run(nombre, `estudiante${usuarioId}@aulanorte.local`);
        insertarEstudiante.run(usuarioId, `AN-2026-${String(estudianteId).padStart(3, '0')}`, salon.grado, salon.seccion, `Familia ${nombre.split(' ')[0]}`, salon.id);
        insertarMatricula.run(estudianteId, salon.cursoId);

        const hoy = new Date();
        perfil.notas.forEach((nota, indice) => {
          const fecha = new Date(hoy);
          fecha.setDate(fecha.getDate() - (21 - indice * 7));
          insertarNota.run(estudianteId, salon.cursoId, nota, ['Práctica 01', 'Evaluación parcial', 'Proyecto de unidad'][indice], indice < perfil.entregas * 3 ? 1 : 0, fechaLocal(fecha));
        });
        const presentes = Math.round(perfil.asistencia / 10);
        for (let sesion = 0; sesion < 10; sesion += 1) {
          const fecha = new Date(hoy);
          fecha.setDate(fecha.getDate() - (9 - sesion));
          const estado = sesion < presentes ? 'Presente' : (sesion === presentes && perfil.asistencia % 10 >= 5 ? 'Tardanza' : 'Ausente');
          insertarAsistencia.run(estudianteId, salon.cursoId, fechaLocal(fecha), estado);
        }
        for (let incidencia = 0; incidencia < perfil.conducta; incidencia += 1) {
          insertarConducta.run(estudianteId, salon.cursoId, 'Seguimiento de convivencia', fechaLocal(hoy));
        }
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function completarCursosDeEstudiantes() {
  const estudiantes = db.prepare('SELECT id, salon_id FROM estudiantes WHERE salon_id IS NOT NULL').all();
  const cursos = db.prepare('SELECT curso_id FROM salon_cursos WHERE salon_id = ?');
  const insertarMatricula = db.prepare('INSERT OR IGNORE INTO matriculas (estudiante_id, curso_id) VALUES (?, ?)');
  const cantidadNotas = db.prepare('SELECT COUNT(*) AS total FROM notas WHERE estudiante_id = ? AND curso_id = ?');
  const cantidadAsistencias = db.prepare('SELECT COUNT(*) AS total FROM asistencia WHERE estudiante_id = ? AND curso_id = ?');
  const insertarNota = db.prepare('INSERT INTO notas (estudiante_id, curso_id, calificacion, evaluacion, entrega_a_tiempo, fecha) VALUES (?, ?, ?, ?, ?, ?)');
  const insertarAsistencia = db.prepare('INSERT OR IGNORE INTO asistencia (estudiante_id, curso_id, fecha, estado) VALUES (?, ?, ?, ?)');
  const perfiles = [
    { notas: [16, 15, 17], asistencia: 90, entregas: 1 },
    { notas: [12, 13, 11], asistencia: 80, entregas: 0.67 },
    { notas: [9, 10, 8], asistencia: 70, entregas: 0.67 },
    { notas: [6, 8, 7], asistencia: 50, entregas: 0.33 },
  ];
  const hoy = new Date();

  db.exec('BEGIN IMMEDIATE');
  try {
    estudiantes.forEach((estudiante) => {
      const perfil = perfiles[(estudiante.id - 1) % perfiles.length];
      cursos.all(estudiante.salon_id).forEach(({ curso_id }) => {
        insertarMatricula.run(estudiante.id, curso_id);
        if (Number(cantidadNotas.get(estudiante.id, curso_id).total) === 0) {
          perfil.notas.forEach((nota, indice) => {
            const fecha = new Date(hoy);
            fecha.setDate(fecha.getDate() - (21 - indice * 7));
            insertarNota.run(estudiante.id, curso_id, nota, ['Práctica 01', 'Evaluación parcial', 'Proyecto de unidad'][indice], indice < perfil.entregas * 3 ? 1 : 0, fechaLocal(fecha));
          });
        }
        if (Number(cantidadAsistencias.get(estudiante.id, curso_id).total) === 0) {
          const presentes = Math.round(perfil.asistencia / 10);
          for (let sesion = 0; sesion < 10; sesion += 1) {
            const fecha = new Date(hoy);
            fecha.setDate(fecha.getDate() - (9 - sesion));
            const estado = sesion < presentes ? 'Presente' : (sesion === presentes && perfil.asistencia % 10 >= 5 ? 'Tardanza' : 'Ausente');
            insertarAsistencia.run(estudiante.id, curso_id, fechaLocal(fecha), estado);
          }
        }
      });
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function sembrarHistorialInicial() {
  const existentes = Number(db.prepare('SELECT COUNT(*) AS total FROM historial_asistencia').get().total);
  if (existentes) return;
  const registros = db.prepare(`
    SELECT e.id AS estudiante_id, e.salon_id, s.curso_id, a.fecha, a.estado
    FROM estudiantes e JOIN salones s ON s.id = e.salon_id
    JOIN asistencia a ON a.estudiante_id = e.id AND a.curso_id = s.curso_id
    WHERE a.fecha = ? ORDER BY e.id
  `).all(fechaLocal(new Date()));
  const insertar = db.prepare(`
    INSERT INTO historial_asistencia
      (estudiante_id, curso_id, salon_id, fecha, estado_anterior, estado_nuevo, motivo, usuario_id)
    VALUES (?, ?, ?, ?, NULL, ?, ?, 1)
  `);
  registros.forEach((registro) => insertar.run(
    registro.estudiante_id, registro.curso_id, registro.salon_id, registro.fecha,
    registro.estado, 'Registro inicial de demostración.',
  ));
}

function sembrarSeguimientosFamiliares() {
  const existentes = Number(db.prepare('SELECT COUNT(*) AS total FROM seguimientos_familia').get().total);
  if (existentes) return;
  const insertar = db.prepare(`
    INSERT INTO seguimientos_familia (estudiante_id, tipo, resultado, nota, proximo_contacto, usuario_id)
    VALUES (?, ?, ?, ?, ?, 1)
  `);
  [
    [1, 'Llamada', 'Completado', 'Se conversó sobre sus avances en matemática y se acordó reforzar los ejercicios de la semana.', '2026-10-06'],
    [2, 'Mensaje', 'Pendiente', 'Se envió una nota a la familia para coordinar una breve reunión de seguimiento.', '2026-10-02'],
    [3, 'Reunión', 'Completado', 'La familia y el docente acordaron revisar las tareas cada viernes.', '2026-10-09'],
    [4, 'Llamada', 'Pendiente', 'Pendiente confirmar una conversación sobre asistencia y puntualidad.', '2026-10-01'],
    [5, 'Observación', 'Completado', 'Se reconoció el progreso y la constancia en las actividades del curso.', '2026-10-13'],
    [8, 'Mensaje', 'Completado', 'Se compartieron estrategias breves para acompañar el hábito de estudio en casa.', '2026-10-08'],
  ].forEach((registro) => insertar.run(...registro));
}

function inicializarVinculosTutores() {
  const estudiantesSinTutor = db.prepare(`
    SELECT e.id, e.codigo, e.usuario_id, u.nombre
    FROM estudiantes e JOIN usuarios u ON u.id = e.usuario_id
    WHERE e.tutor_usuario_id IS NULL ORDER BY e.id
  `).all();
  const crearUsuarioTutor = db.prepare('INSERT INTO usuarios (nombre, correo, rol_id) VALUES (?, ?, 3)');
  const vincularTutor = db.prepare('UPDATE estudiantes SET tutor_usuario_id = ? WHERE id = ?');
  db.exec('BEGIN IMMEDIATE');
  try {
    estudiantesSinTutor.forEach((estudiante) => {
      const nombreTutor = `Tutor de ${estudiante.nombre}`;
      const correo = `tutor-${estudiante.codigo.toLowerCase()}@aulanorte.local`;
      crearUsuarioTutor.run(nombreTutor, correo);
      const tutorId = Number(db.prepare('SELECT last_insert_rowid() AS id').get().id);
      vincularTutor.run(tutorId, estudiante.id);
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function inicializarDatos() {
  const insertarRol = db.prepare('INSERT INTO roles (id, nombre) VALUES (?, ?)');
  const insertarUsuario = db.prepare('INSERT INTO usuarios (id, nombre, correo, rol_id) VALUES (?, ?, ?, ?)');
  const insertarEstudiante = db.prepare('INSERT INTO estudiantes (id, usuario_id, codigo, grado, seccion, tutor) VALUES (?, ?, ?, ?, ?, ?)');
  const insertarCurso = db.prepare('INSERT INTO cursos (id, nombre, grado, seccion, docente_id) VALUES (?, ?, ?, ?, ?)');
  const insertarMatricula = db.prepare('INSERT INTO matriculas (estudiante_id, curso_id) VALUES (?, ?)');
  const insertarNota = db.prepare('INSERT INTO notas (estudiante_id, curso_id, calificacion, evaluacion, entrega_a_tiempo, fecha) VALUES (?, ?, ?, ?, ?, ?)');
  const insertarAsistencia = db.prepare('INSERT INTO asistencia (estudiante_id, curso_id, fecha, estado) VALUES (?, ?, ?, ?)');
  const insertarConducta = db.prepare('INSERT INTO conductas (estudiante_id, curso_id, descripcion, fecha) VALUES (?, ?, ?, ?)');

  db.exec('BEGIN');
  try {
    [['Administrador', 1], ['Docente', 2], ['Estudiante/Tutor', 3]].forEach(([nombre, id]) => insertarRol.run(id, nombre));
    [
      [1, 'Lucía Valdivia', 'admin@aulanorte.local', 1],
      [2, 'Marco Salazar', 'marco.salazar@aulanorte.local', 2],
      [3, 'Elena Ríos', 'elena.rios@aulanorte.local', 2],
      [4, 'Ana Torres', 'ana.torres@aulanorte.local', 3],
      [5, 'Diego Paredes', 'diego.paredes@aulanorte.local', 3],
      [6, 'María Castañeda', 'maria.castaneda@aulanorte.local', 3],
      [7, 'Luis Mendoza', 'luis.mendoza@aulanorte.local', 3],
      [8, 'Camila Flores', 'camila.flores@aulanorte.local', 3],
      [9, 'Joaquín Vera', 'joaquin.vera@aulanorte.local', 3],
      [10, 'Valeria León', 'valeria.leon@aulanorte.local', 3],
      [11, 'Andrés Ruiz', 'andres.ruiz@aulanorte.local', 3],
    ].forEach((usuario) => insertarUsuario.run(...usuario));

    const estudiantes = [
      { id: 1, usuario: 4, nombre: 'Ana Torres', grado: '5.º', seccion: 'A', curso: 1, notas: [17, 16, 18], asistencia: 96, entregas: 1, conducta: 0 },
      { id: 2, usuario: 5, nombre: 'Diego Paredes', grado: '5.º', seccion: 'A', curso: 1, notas: [11, 10, 12], asistencia: 78, entregas: 0.67, conducta: 1 },
      { id: 3, usuario: 6, nombre: 'María Castañeda', grado: '5.º', seccion: 'A', curso: 1, notas: [9, 10, 8], asistencia: 68, entregas: 0.33, conducta: 2 },
      { id: 4, usuario: 7, nombre: 'Luis Mendoza', grado: '5.º', seccion: 'A', curso: 1, notas: [7, 8, 6], asistencia: 46, entregas: 0.33, conducta: 6 },
      { id: 5, usuario: 8, nombre: 'Camila Flores', grado: '5.º', seccion: 'B', curso: 2, notas: [15, 14, 16], asistencia: 92, entregas: 1, conducta: 0 },
      { id: 6, usuario: 9, nombre: 'Joaquín Vera', grado: '5.º', seccion: 'B', curso: 2, notas: [12, 13, 11], asistencia: 86, entregas: 0.67, conducta: 1 },
      { id: 7, usuario: 10, nombre: 'Valeria León', grado: '5.º', seccion: 'B', curso: 2, notas: [10, 9, 11], asistencia: 72, entregas: 0.67, conducta: 2 },
      { id: 8, usuario: 11, nombre: 'Andrés Ruiz', grado: '4.º', seccion: 'A', curso: 3, notas: [8, 7, 9], asistencia: 58, entregas: 0.33, conducta: 4 },
    ];
    estudiantes.forEach((estudiante) => insertarEstudiante.run(
      estudiante.id, estudiante.usuario, `AN-2026-${String(estudiante.id).padStart(3, '0')}`,
      estudiante.grado, estudiante.seccion, `Familia ${estudiante.nombre.split(' ')[0]}`,
    ));

    [[1, 'Matemática', '5.º', 'A', 2], [2, 'Comunicación', '5.º', 'B', 3], [3, 'Ciencia y Tecnología', '4.º', 'A', 2]]
      .forEach((curso) => insertarCurso.run(...curso));

    const hoy = new Date();
    estudiantes.forEach((estudiante) => {
      insertarMatricula.run(estudiante.id, estudiante.curso);
      estudiante.notas.forEach((nota, indice) => {
        const fecha = new Date(hoy);
        fecha.setDate(fecha.getDate() - (21 - indice * 7));
        insertarNota.run(estudiante.id, estudiante.curso, nota, ['Práctica 01', 'Evaluación parcial', 'Proyecto de unidad'][indice], indice < estudiante.entregas * 3 ? 1 : 0, fechaLocal(fecha));
      });
      const presentes = Math.round(estudiante.asistencia / 10);
      for (let sesion = 0; sesion < 10; sesion += 1) {
        const fecha = new Date(hoy);
        fecha.setDate(fecha.getDate() - (9 - sesion));
        const estado = sesion < presentes ? 'Presente' : (sesion === presentes && estudiante.asistencia % 10 >= 5 ? 'Tardanza' : 'Ausente');
        insertarAsistencia.run(estudiante.id, estudiante.curso, fechaLocal(fecha), estado);
      }
      for (let incidencia = 0; incidencia < estudiante.conducta; incidencia += 1) {
        insertarConducta.run(estudiante.id, estudiante.curso, 'Seguimiento de convivencia', fechaLocal(hoy));
      }
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

}
