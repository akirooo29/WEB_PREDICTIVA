import { lazy, Suspense, useEffect, useState } from 'react';
import {
  Bell, BookOpen, CalendarDays, ChartNoAxesCombined, CircleHelp, ClipboardCheck, ClipboardList, DatabaseBackup,
  FileClock, GraduationCap, LayoutDashboard, Moon, PhoneCall, Search, ShieldCheck, Sun, Users,
} from 'lucide-react';

// 1. IMPORTAMOS TU CLIENTE SEGURO
import { apiClient } from './services/apiClient';

const DistribucionRiesgo = lazy(() => import('./components/DistribucionRiesgo.jsx'));
const FichaEstudiante = lazy(() => import('./components/FichaEstudiante.jsx'));
const ControlAsistenciaSalon = lazy(() => import('./components/ControlAsistenciaSalon.jsx'));
const HistorialAsistencia = lazy(() => import('./components/HistorialAsistencia.jsx'));
const ImportarExportar = lazy(() => import('./components/ImportarExportar.jsx'));
const PanelDashboard = lazy(() => import('./components/PanelDashboard.jsx'));
const RegistroAcademico = lazy(() => import('./components/RegistroAcademico.jsx'));
const SeguimientoFamilias = lazy(() => import('./components/SeguimientoFamilias.jsx'));
const TablaAlertas = lazy(() => import('./components/TablaAlertas.jsx'));

const navegacion = [
  { id: 'resumen', texto: 'Resumen', icono: LayoutDashboard },
  { id: 'alertas', texto: 'Alertas predictivas', icono: ChartNoAxesCombined },
  { id: 'asistencia', texto: 'Asistencia por salón', icono: ClipboardCheck },
  { id: 'historial', texto: 'Historial y reportes', icono: FileClock },
  { id: 'seguimiento', texto: 'Seguimiento familiar', icono: PhoneCall },
  { id: 'registro', texto: 'Notas por salón', icono: ClipboardList },
  { id: 'datos', texto: 'Importar / exportar', icono: DatabaseBackup },
];

async function obtener(ruta) {
  try {
    const token = localStorage.getItem('token_jwt');
    const opciones = {
      headers: { ...(token && { 'Authorization': `Bearer ${token}` }) }
    };
    const respuesta = await fetch(ruta, opciones);
    if (!respuesta.ok) return null;
    return await respuesta.json();
  } catch (e) {
    return null;
  }
}

export default function App() {
  // =========================================================================
  // ESTADOS DE SEGURIDAD (Tus credenciales y token JWT)
  // =========================================================================
  const [token, setToken] = useState(localStorage.getItem('token_jwt'));
  const [email, setEmail] = useState('profesor1@demo.com');
  const [password, setPassword] = useState('Password123!');
  const [errorAcceso, setErrorAcceso] = useState('');

  // =========================================================================
  // ESTADOS DEL DASHBOARD (De tu compañero)
  // =========================================================================
  const [datos, setDatos] = useState({ resumen: null, alertas: [], evolucion: [], cursos: [], estudiantes: [], salones: [] });
  const [perfilesDemo, setPerfilesDemo] = useState([]);
  const [perfilActual, setPerfilActual] = useState(null);
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState(null);
  const [filtrosDashboard, setFiltrosDashboard] = useState({ salon: '', curso: '', desde: '', hasta: '' });
  const [rol, setRol] = useState('Administrador');
  const [temaOscuro, setTemaOscuro] = useState(() => localStorage.getItem('aula-tema') === 'oscuro');
  const [seccionActiva, setSeccionActiva] = useState('resumen');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  async function actualizar(filtros = filtrosDashboard) {
    try {
      const parametrosDashboard = new URLSearchParams(Object.fromEntries(
        Object.entries(filtros).filter(([, valor]) => valor),
      ));
      const queryDashboard = parametrosDashboard.toString() ? `?${parametrosDashboard}` : '';
      const [resumen, alertas, cursos, estudiantes, salones] = await Promise.all([
        obtener(`/api/dashboard${queryDashboard}`), obtener('/api/predicciones-riesgo'),
        obtener('/api/cursos'), obtener('/api/estudiantes'), obtener('/api/salones'),
      ]);
      setDatos({
        resumen: resumen?.resumen || null,
        alertas: alertas || [],
        evolucion: resumen?.evolucion || [],
        cursos: cursos || [],
        estudiantes: estudiantes || [],
        salones: salones || []
      });
      setError('');
    } catch (fallo) {
      setError("Error al cargar datos del backend.");
    } finally {
      setCargando(false);
    }
  }

  // 2. MODIFICAMOS EL USE-EFFECT PARA QUE ESPERE EL TOKEN DE C#
  useEffect(() => {
    if (!token) return; // Si no hay token, no intenta cargar la UI interna

    let vigente = true;
    async function cargarDatosConToken() {
      try {
        await actualizar();
        // Como la API en C# aún no tiene /api/perfiles-demo, forzamos un perfil visual temporal
        if (vigente) {
          setPerfilActual({ nombre: 'Profesor (C#)', rol: 'Profesor' });
          setRol('Profesor');
        }
      } catch (fallo) {
        if (vigente) setError(fallo.message);
      }
    }
    cargarDatosConToken();
    return () => { vigente = false; };
  }, [token]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', temaOscuro);
    localStorage.setItem('aula-tema', temaOscuro ? 'oscuro' : 'claro');
  }, [temaOscuro]);

  const prediccionesVisibles = datos.alertas || [];
  const resumenVisible = datos.resumen;
  const prediccionesDashboard = (datos.alertas || []).filter((fila) =>
    (!filtrosDashboard.salon || String(fila.salon_id) === filtrosDashboard.salon)
    && (!filtrosDashboard.curso || String(fila.curso_id) === filtrosDashboard.curso));
  const iniciales = perfilActual?.nombre?.split(' ').map((parte) => parte[0]).slice(0, 2).join('') || 'PR';

  function cambiarFiltroDashboard(nombre, valor) {
    const nuevosFiltros = nombre === 'restablecer'
      ? { salon: '', curso: '', desde: '', hasta: '' }
      : { ...filtrosDashboard, [nombre]: valor, ...(nombre === 'salon' ? { curso: '' } : {}) };
    setFiltrosDashboard(nuevosFiltros);
    actualizar(nuevosFiltros);
  }

  function irASeccion(id) {
    setSeccionActiva(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const fechaActual = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // =========================================================================
  // 3. EL MURO DE SEGURIDAD (Si no hay token, renderiza SOLO el login)
  // =========================================================================
  if (!token) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }}>
        <div style={{ padding: '2.5rem', backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', width: '100%', maxWidth: '400px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', textAlign: 'center', color: '#1f2937' }}>Aula Norte - Acceso</h2>

          {errorAcceso && (
            <div style={{ backgroundColor: '#fee2e2', borderLeft: '4px solid #ef4444', color: '#b91c1c', padding: '0.75rem', marginBottom: '1.5rem', borderRadius: '0.25rem', fontSize: '0.875rem' }}>
              {errorAcceso}
            </div>
          )}

          <form onSubmit={async (e) => {
            e.preventDefault();
            setErrorAcceso('');
            try {
              // Aquí conectamos con tu backend C# en el puerto 5039
              const respuesta = await apiClient.post('/api/Auth/login', { email, password });
              if (respuesta.token) {
                localStorage.setItem('token_jwt', respuesta.token);
                setToken(respuesta.token);
              } else {
                setErrorAcceso("Credenciales incorrectas.");
              }
            } catch (error) {
              setErrorAcceso("Error de conexión. Verifica que la API en C# esté encendida.");
            }
          }}>

            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', marginBottom: '1rem', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', boxSizing: 'border-box', outline: 'none' }}
              placeholder="Correo electrónico" required
            />
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', marginBottom: '1.5rem', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', boxSizing: 'border-box', outline: 'none' }}
              placeholder="Contraseña" required
            />
            <button type="submit" style={{ width: '100%', backgroundColor: '#2563eb', color: 'white', fontWeight: 'bold', padding: '0.75rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', transition: 'background-color 0.3s' }}>
              Iniciar Sesión Seguro
            </button>
          </form>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 4. EL DASHBOARD ORIGINAL (Solo se renderiza si pasaste el login)
  // =========================================================================
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#resumen" onClick={() => irASeccion('resumen')}>
          <span className="brand-mark"><BookOpen size={20} /></span>
          <span><strong>Aula Norte</strong><small>GESTIÓN ACADÉMICA</small></span>
        </a>
        <div className="school-switch"><span className="school-monogram">SN</span><span><strong>San Nicolás</strong><small>Institución educativa</small></span><span className="switch-dots">···</span></div>
        <p className="nav-caption">ESPACIO DE TRABAJO</p>
        <nav className="side-nav" aria-label="Navegación principal">
          {navegacion.map(({ id, texto, icono: Icon }) => (
            <button key={id} className={seccionActiva === id ? 'nav-item nav-item-active' : 'nav-item'} onClick={() => irASeccion(id)}>
              <Icon size={17} strokeWidth={1.8} /><span>{texto}</span>{id === 'alertas' && <i className="nav-count">{new Set(prediccionesVisibles.filter((fila) => fila.nivel === 'Alto').map((fila) => fila.estudiante_id)).size || ''}</i>}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-support"><CircleHelp size={16} /><span>Centro de soporte</span></div>
        <div className="sidebar-user"><span className="user-avatar">{iniciales}</span><span><strong>{perfilActual?.nombre || 'Profesor (C#)'}</strong><small>{perfilActual?.rol || 'Profesor'}</small></span><span className="user-menu">···</span></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Institución</span><span>/</span><strong>Panel académico</strong></div>
          <div className="topbar-actions">
            <span className="today-date"><CalendarDays size={15} /> {fechaActual}</span>
            <button className="icon-button search-button" aria-label="Buscar"><Search size={18} /></button>
            <button className="icon-button notification-button" aria-label="Notificaciones"><Bell size={18} /><i /></button>
            <span className="topbar-divider" />
            <button className="icon-button theme-button" onClick={() => setTemaOscuro((actual) => !actual)} aria-label={temaOscuro ? 'Activar modo claro' : 'Activar modo oscuro'}>
              {temaOscuro ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <span className="topbar-avatar">{iniciales}</span>

            {/* 5. BOTÓN DE CERRAR SESIÓN */}
            <button
              onClick={() => { localStorage.removeItem('token_jwt'); setToken(null); }}
              style={{ padding: '6px 12px', backgroundColor: '#ef4444', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
            >
              Salir
            </button>
          </div>
        </header>

        <div className="page-content">
          {error && <div className="connection-alert" role="alert"><ShieldCheck size={18} />{error}<button onClick={actualizar}>Reintentar</button></div>}
          {cargando ? <div className="loading-state"><span className="loading-mark"><GraduationCap size={24} /></span><strong>Preparando el panel académico...</strong></div> : <Suspense key={perfilActual?.usuarioId} fallback={<div className="loading-state">Cargando panel...</div>}>
            <PanelDashboard resumen={resumenVisible} evolucion={datos.evolucion} rol={rol} salones={datos.salones} cursos={datos.cursos} filtros={filtrosDashboard} onCambioFiltro={cambiarFiltroDashboard} />
            <div className="insights-grid">
              <DistribucionRiesgo predicciones={prediccionesDashboard} />
              <article className="insight-note">
                <div className="insight-mark"><Users size={19} /></div>
                <p className="eyebrow">Acompañamiento oportuno</p>
                <h3>Una señal a tiempo cambia el recorrido.</h3>
                <p>Las alertas priorizan a quienes podrían beneficiarse de un refuerzo o una conversación cercana.</p>
                <button onClick={() => irASeccion('alertas')}>Ver estudiantes priorizados <span>→</span></button>
              </article>
            </div>
            <TablaAlertas predicciones={prediccionesVisibles} cursos={datos.cursos} salones={datos.salones} onAbrirFicha={setEstudianteSeleccionado} />
            <ControlAsistenciaSalon key={perfilActual?.usuarioId} perfilId={perfilActual?.usuarioId} salones={datos.salones} onGuardado={actualizar} soloLectura={rol === 'Estudiante / Tutor'} puedeConfigurar={rol === 'Administrador'} />
            <HistorialAsistencia key={perfilActual?.usuarioId} salones={datos.salones} estudiantes={datos.estudiantes} />
            <SeguimientoFamilias key={perfilActual?.usuarioId} estudiantes={datos.estudiantes} soloLectura={rol === 'Estudiante / Tutor'} />
            {rol !== 'Estudiante / Tutor' && <RegistroAcademico salones={datos.salones} estudiantes={datos.estudiantes} onGuardado={actualizar} />}
            <ImportarExportar key={perfilActual?.usuarioId} soloLectura={rol === 'Estudiante / Tutor'} onImportado={actualizar} />
            {estudianteSeleccionado && <FichaEstudiante estudianteId={estudianteSeleccionado} onCerrar={() => setEstudianteSeleccionado(null)} />}
          </Suspense>}
          <footer className="page-footer"><span>Aula Norte <span className="footer-dot">·</span> Gestión local de datos académicos</span><span>Trujillo, La Libertad</span></footer>
        </div>
      </main>
    </div>
  );
}