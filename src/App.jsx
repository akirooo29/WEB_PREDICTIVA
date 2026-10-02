import { lazy, Suspense, useEffect, useState } from 'react';
import {
  Bell, BookOpen, CalendarDays, ChartNoAxesCombined, CircleHelp, ClipboardCheck, ClipboardList, DatabaseBackup,
  FileClock, GraduationCap, LayoutDashboard, Moon, PhoneCall, Search, ShieldCheck, Sun, Users,
} from 'lucide-react';

// 1. IMPORTAMOS TU CLIENTE SEGURO
import { apiClient } from './services/apiClient';
import ModalSeguridad2FA from './components/ModalSeguridad2FA';
import PanelProfesor from './components/PanelProfesor';


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
  { id: 'notas', texto: 'Notas por salón', icono: ClipboardList },
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

// Función para desencriptar el Token JWT y extraer los datos del usuario
function decodificarToken(token) {
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
    return JSON.parse(jsonPayload);
  } catch (error) {
    return null;
  }
}

// =========================================================================
// PANELES DE VISTA SEGÚN ROL (Placeholders de prueba)
// =========================================================================
const PanelAdministrador = () => <div style={{ padding: '2rem' }}><h2>Panel de Administrador</h2><p>Control total del sistema.</p></div>;
const PanelEstudiante = () => <div style={{ padding: '2rem' }}><h2>Mi Progreso</h2><p>Ver mis calificaciones.</p></div>;

export default function App() {
  // =========================================================================
  // ESTADOS DE SEGURIDAD (Tus credenciales y token JWT)
  // =========================================================================
  const [token, setToken] = useState(localStorage.getItem('token_jwt'));
  const [email, setEmail] = useState('profesor1@demo.com');
  const [password, setPassword] = useState('Password123!');
  const [errorAcceso, setErrorAcceso] = useState('');
  const [mostrarSeguridad, setMostrarSeguridad] = useState(false);

  // =========================================================================
  // ESTADOS DEL DASHBOARD
  // =========================================================================
  const [datos, setDatos] = useState({ resumen: null, alertas: [], evolucion: [], cursos: [], estudiantes: [], salones: [] });
  const [perfilesDemo, setPerfilesDemo] = useState([]);
  const [perfilActual, setPerfilActual] = useState(null);
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState(null);
  const [filtrosDashboard, setFiltrosDashboard] = useState({ salon: '', curso: '', desde: '', hasta: '' });
  const [rol, setRol] = useState(() => {
    const tokenGuardado = localStorage.getItem('token_jwt');
    const payload = decodificarToken(tokenGuardado);
    return payload ? (payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || payload.role || 'Usuario') : '';
  });
  const [temaOscuro, setTemaOscuro] = useState(() => localStorage.getItem('aula-tema') === 'oscuro');
  const [vistaActual, setVistaActual] = useState('resumen'); // 'resumen', 'alertas', 'asistencia', 'historial', 'notas'
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

  // 2. USE-EFFECT PARA LEER EL TOKEN DE C#
  useEffect(() => {
    if (!token) return; // Si no hay token, no intenta cargar la UI interna

    let vigente = true;
    async function cargarDatosConToken() {
      try {
        await actualizar();

        if (vigente) {
          // 1. Desencriptamos la llave
          const payload = decodificarToken(token);

          if (payload) {
            // 2. Extraemos los valores exactos que tu AuthController está enviando
            const rolReal = payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || payload.role || 'Usuario';
            const nombreReal = payload.nombre || payload.sub || 'Usuario';

            // 3. Actualizamos la interfaz
            setPerfilActual({ nombre: nombreReal, rol: rolReal });
            setRol(rolReal);
          }
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
  const iniciales = perfilActual?.nombre?.split(' ').map((parte) => parte[0]).slice(0, 2).join('') || 'US';

  function cambiarFiltroDashboard(nombre, valor) {
    const nuevosFiltros = nombre === 'restablecer'
      ? { salon: '', curso: '', desde: '', hasta: '' }
      : { ...filtrosDashboard, [nombre]: valor, ...(nombre === 'salon' ? { curso: '' } : {}) };
    setFiltrosDashboard(nuevosFiltros);
    actualizar(nuevosFiltros);
  }

  function irASeccion(id) {
    setVistaActual(id);
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
                const payload = decodificarToken(respuesta.token);
                if (payload) {
                  const rolReal = payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || payload.role || 'Usuario';
                  const nombreReal = payload.nombre || payload.sub || 'Usuario';
                  setPerfilActual({ nombre: nombreReal, rol: rolReal });
                  setRol(rolReal);
                }
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
        <a className="brand" href="#resumen" onClick={(e) => { e.preventDefault(); setVistaActual('resumen'); }}>
          <span className="brand-mark"><BookOpen size={20} /></span>
          <span><strong>Aula Norte</strong><small>GESTIÓN ACADÉMICA</small></span>
        </a>
        <div className="school-switch"><span className="school-monogram">SN</span><span><strong>San Nicolás</strong><small>Institución educativa</small></span><span className="switch-dots">···</span></div>
        <p className="nav-caption">ESPACIO DE TRABAJO</p>
        <nav className="side-nav" aria-label="Navegación principal">
          {navegacion.map(({ id, texto, icono: Icon }) => (
            <button
              key={id}
              className={vistaActual === id ? 'nav-item nav-item-active' : 'nav-item'}
              onClick={() => setVistaActual(id)}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{texto}</span>
              {id === 'alertas' && <i className="nav-count">{new Set(prediccionesVisibles.filter((fila) => fila.nivel === 'Alto').map((fila) => fila.estudiante_id)).size || ''}</i>}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-support"><CircleHelp size={16} /><span>Centro de soporte</span></div>
        <div className="sidebar-user"><span className="user-avatar">{iniciales}</span><span><strong>{perfilActual?.nombre || 'Usuario'}</strong><small>{perfilActual?.rol || rol || 'Usuario'}</small></span><span className="user-menu">···</span></div>
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
            <button className="icon-button" onClick={() => setMostrarSeguridad(true)} title="Configurar Autenticador 2FA">
              <ShieldCheck size={18} />
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
          {rol === 'Administrador' && <PanelAdministrador />}

          {rol === 'Profesor' && (
            <>
              {vistaActual === 'resumen' && <PanelProfesor />}

              {vistaActual === 'alertas' && (
                <div style={{ padding: '2rem', width: '100%' }}>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.5rem' }}>
                    Módulo de Alertas Predictivas de Riesgo Académico
                  </h2>
                  <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
                    Detección temprana con Inteligencia Artificial (Random Forest) para acompañamiento de estudiantes en riesgo.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ backgroundColor: 'white', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #fee2e2', borderLeft: '4px solid #ef4444' }}>
                      <h4 style={{ color: '#b91c1c', fontWeight: 'bold', margin: '0 0 0.25rem' }}>🔴 Alertas de Riesgo Alto</h4>
                      <p style={{ color: '#4b5563', fontSize: '0.875rem', margin: 0 }}>Estudiantes con probabilidad crítica (&gt; 70%). Requieren intervención pedagógica y tutoría personalizada.</p>
                    </div>
                    <div style={{ backgroundColor: 'white', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #fef3c7', borderLeft: '4px solid #f59e0b' }}>
                      <h4 style={{ color: '#b45309', fontWeight: 'bold', margin: '0 0 0.25rem' }}>🟡 Alertas de Riesgo Medio</h4>
                      <p style={{ color: '#4b5563', fontSize: '0.875rem', margin: 0 }}>Estudiantes con calificaciones irregulares (40% - 69%). Monitorear asistencia y entrega de actividades.</p>
                    </div>
                    <div style={{ backgroundColor: 'white', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #d1fae5', borderLeft: '4px solid #10b981' }}>
                      <h4 style={{ color: '#047857', fontWeight: 'bold', margin: '0 0 0.25rem' }}>🟢 Rendimiento Estable</h4>
                      <p style={{ color: '#4b5563', fontSize: '0.875rem', margin: 0 }}>Estudiantes con bajo riesgo de deserción y calificaciones en el rango esperado.</p>
                    </div>
                  </div>
                  <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e5e7eb' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '0.5rem' }}>
                      Detalle individual por Sección
                    </h3>
                    <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
                      Para visualizar la clasificación detallada de cada estudiante por aula, navega al <strong>Resumen</strong> y presiona el botón <strong>Gestionar Notas</strong> en cualquiera de tus aulas.
                    </p>
                  </div>
                </div>
              )}

              {vistaActual === 'asistencia' && (
                <div style={{ padding: '2rem', width: '100%' }}>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.5rem' }}>
                    Módulo de Asistencia por Salón
                  </h2>
                  <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
                    Control de asistencia diaria, tardanzas y justificaciones de los alumnos matriculados.
                  </p>
                  <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#2563eb', marginBottom: '0.75rem' }}>
                      <ClipboardCheck size={24} />
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0, color: '#1f2937' }}>Sesión de Asistencia</h3>
                    </div>
                    <p style={{ color: '#4b5563', fontSize: '0.9rem', margin: 0 }}>
                      El registro diario de asistencias impacta directamente en las predicciones de permanencia estudiantil del modelo de IA. Selecciona tu sección en el <strong>Resumen</strong> para gestionar a los estudiantes.
                    </p>
                  </div>
                </div>
              )}

              {vistaActual === 'notas' && (
                <div style={{ padding: '2rem', width: '100%' }}>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.5rem' }}>
                    Módulo de Notas por Salón
                  </h2>
                  <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
                    Registro de evaluaciones continuas, exámenes bimestrales y actas de notas del periodo 2026-I.
                  </p>
                  <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#10b981', marginBottom: '0.75rem' }}>
                      <ClipboardList size={24} />
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0, color: '#1f2937' }}>Planilla de Calificaciones</h3>
                    </div>
                    <p style={{ color: '#4b5563', fontSize: '0.9rem', margin: 0 }}>
                      Ingresa a la sección <strong>Resumen</strong> y presiona <strong>Gestionar Notas</strong> para ver la lista nominal de alumnos y registrar sus notas correspondientes al curso seleccionado.
                    </p>
                  </div>
                </div>
              )}

              {vistaActual === 'historial' && (
                <div style={{ padding: '2rem', width: '100%' }}>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.5rem' }}>
                    Historial y Reportes
                  </h2>
                  <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
                    Trazabilidad de evolución académica y reportes consolidados del periodo.
                  </p>
                  <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e5e7eb' }}>
                    <p style={{ color: '#4b5563', fontSize: '0.9rem', margin: 0 }}>Reportes estadísticos e historial de rendimiento disponibles.</p>
                  </div>
                </div>
              )}

              {vistaActual === 'seguimiento' && (
                <div style={{ padding: '2rem', width: '100%' }}>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.5rem' }}>
                    Seguimiento Familiar
                  </h2>
                  <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
                    Canal de contacto y citaciones con apoderados para alumnos con alertas predictivas.
                  </p>
                  <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e5e7eb' }}>
                    <p style={{ color: '#4b5563', fontSize: '0.9rem', margin: 0 }}>Registro de compromisos y acompañamiento familiar.</p>
                  </div>
                </div>
              )}

              {vistaActual === 'datos' && (
                <div style={{ padding: '2rem', width: '100%' }}>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.5rem' }}>
                    Importar / Exportar
                  </h2>
                  <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
                    Descarga de nóminas de estudiantes y reportes de riesgo en formatos estándar.
                  </p>
                  <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e5e7eb' }}>
                    <p style={{ color: '#4b5563', fontSize: '0.9rem', margin: 0 }}>Módulo de transferencia de datos académicos.</p>
                  </div>
                </div>
              )}
            </>
          )}

          {rol === 'Estudiante' && <PanelEstudiante />}
          <footer className="page-footer"><span>Aula Norte <span className="footer-dot">·</span> Gestión local de datos académicos</span><span>Trujillo, La Libertad</span></footer>
        </div>

        {/* 2. AGREGAR EL MODAL DE SEGURIDAD */}
        {mostrarSeguridad && (
          <ModalSeguridad2FA
            email={email}
            onClose={() => setMostrarSeguridad(false)}
            onCerrar={() => setMostrarSeguridad(false)}
          />
        )}
      </main>
    </div>
  );
}