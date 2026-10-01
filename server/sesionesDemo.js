import { randomUUID } from 'node:crypto';

const sesiones = new Map();

function perfilesDisponibles(db) {
  const administrador = db.prepare(`
    SELECT u.id, u.nombre, r.nombre AS rol FROM usuarios u
    JOIN roles r ON r.id = u.rol_id WHERE r.nombre = 'Administrador' ORDER BY u.id LIMIT 1
  `).get();
  const docente = db.prepare(`
    SELECT u.id, u.nombre, r.nombre AS rol FROM cursos c
    JOIN usuarios u ON u.id = c.docente_id JOIN roles r ON r.id = u.rol_id
    ORDER BY u.id LIMIT 1
  `).get();
  const tutor = db.prepare(`
    SELECT u.id, u.nombre, r.nombre AS rol FROM estudiantes e
    JOIN usuarios u ON u.id = e.tutor_usuario_id JOIN roles r ON r.id = u.rol_id
    WHERE e.id = 1
  `).get();
  return [administrador, docente, tutor].filter(Boolean);
}

export function registrarSesionesDemo(app, db) {
  app.get('/api/perfiles-demo', (_req, res) => res.json(perfilesDisponibles(db)));

  app.post('/api/sesion-demo', (req, res) => {
    const usuarioId = Number(req.body.usuarioId);
    const perfil = perfilesDisponibles(db).find((candidato) => candidato.id === usuarioId);
    if (!perfil) return res.status(400).json({ error: 'Selecciona uno de los perfiles locales de demostración.' });
    const token = randomUUID();
    sesiones.set(token, perfil.id);
    res.setHeader('Set-Cookie', `aula_demo=${token}; Path=/; HttpOnly; SameSite=Strict`);
    res.json({ usuarioId: perfil.id, nombre: perfil.nombre, rol: perfil.rol });
  });

  app.use('/api', (req, res, next) => {
    if (req.path === '/salud' || req.path === '/perfiles-demo' || req.path === '/sesion-demo') return next();
    const token = req.headers.cookie?.split(';').map((parte) => parte.trim()).find((parte) => parte.startsWith('aula_demo='))?.slice('aula_demo='.length);
    const usuarioId = token && sesiones.get(token);
    if (!usuarioId) return res.status(401).json({ error: 'La sesión local venció. Selecciona de nuevo un perfil demo.' });
    const actor = db.prepare(`
      SELECT u.id, u.nombre, r.nombre AS rol FROM usuarios u
      JOIN roles r ON r.id = u.rol_id WHERE u.id = ? AND u.activo = 1
    `).get(usuarioId);
    if (!actor) return res.status(401).json({ error: 'El perfil demo ya no está disponible.' });
    req.actor = actor;
    next();
  });
}
