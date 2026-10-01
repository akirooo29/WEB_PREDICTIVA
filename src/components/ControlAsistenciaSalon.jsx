import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Check, ClipboardCheck, Clock3, FileUp, Search, Users } from 'lucide-react';
import { Button, RiskBadge, SectionHeading } from './Ui.jsx';

const fechaLocal = () => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
};
const opcionesEstado = [
  { valor: 'Presente', texto: 'Asistencia' },
  { valor: 'Ausente', texto: 'Inasistencia' },
  { valor: 'Tardanza', texto: 'Tarde' },
  { valor: 'Justificado', texto: 'Justificado' },
];

export default function ControlAsistenciaSalon({ salones, onGuardado, soloLectura = false, puedeConfigurar = false, perfilId }) {
  const [salonId, setSalonId] = useState(String(salones[0]?.id || ''));
  const [fecha, setFecha] = useState(fechaLocal);
  const [registro, setRegistro] = useState(null);
  const [estados, setEstados] = useState({});
  const [motivos, setMotivos] = useState({});
  const [archivos, setArchivos] = useState({});
  const [umbralTardanzas, setUmbralTardanzas] = useState(3);
  const [guardandoRegla, setGuardandoRegla] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const consulta = useDeferredValue(busqueda.trim().toLocaleLowerCase('es'));

  useEffect(() => {
    if (!salonId) return undefined;
    let vigente = true;
    setCargando(true);
    setRegistro(null);
    setError('');
    fetch(`/api/salones/${salonId}/asistencia?fecha=${fecha}`)
      .then(async (respuesta) => {
        const datos = await respuesta.json();
        if (!respuesta.ok) throw new Error(datos.error || 'No se pudo cargar el salón.');
        return datos;
      })
      .then((datos) => {
        if (!vigente) return;
        setRegistro(datos);
        setEstados(Object.fromEntries(datos.alumnos.map((alumno) => [alumno.estudiante_id, alumno.estado || ''])));
        setMotivos(Object.fromEntries(datos.alumnos.map((alumno) => [alumno.estudiante_id, alumno.motivo || ''])));
        setArchivos({});
      })
      .catch((fallo) => { if (vigente) setError(fallo.message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [salonId, fecha, perfilId]);

  useEffect(() => {
    fetch('/api/configuracion/asistencia').then((respuesta) => respuesta.json())
      .then((datos) => setUmbralTardanzas(datos.tardanzasPorInasistencia || 3)).catch(() => {});
  }, []);

  const alumnosFiltrados = useMemo(() => (registro?.alumnos || []).filter((alumno) =>
    `${alumno.nombre} ${alumno.codigo}`.toLocaleLowerCase('es').includes(consulta)), [registro, consulta]);
  const resumenEnVivo = useMemo(() => {
    const resumen = { total: registro?.alumnos.length || 0, Presente: 0, Ausente: 0, Tardanza: 0, Justificado: 0, pendientes: 0 };
    Object.values(estados).forEach((estado) => {
      if (estado) resumen[estado] += 1;
      else resumen.pendientes += 1;
    });
    return resumen;
  }, [estados, registro]);
  const cantidadMarcados = Object.values(estados).filter(Boolean).length;
  const totalSalones = salones.reduce((suma, salon) => suma + salon.estudiantes, 0);

  function marcarTodos(estado) {
    if (!registro) return;
    setEstados(Object.fromEntries(registro.alumnos.map((alumno) => [alumno.estudiante_id, estado])));
    setArchivos({});
    setMensaje('');
  }

  async function guardarAsistencia() {
    const registros = Object.entries(estados)
      .filter(([, estado]) => estado)
      .map(([estudianteId, estado]) => ({ estudianteId: Number(estudianteId), estado, motivo: motivos[estudianteId] || '', archivo: estado === 'Justificado' ? archivos[estudianteId] || null : null }));
    if (!registros.length) return;
    setGuardando(true);
    setError('');
    setMensaje('');
    try {
      const respuesta = await fetch(`/api/salones/${salonId}/asistencia`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, registros }),
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok) throw new Error(resultado.error || 'No se pudo guardar la asistencia.');
      setMensaje(resultado.mensaje);
      await onGuardado();
      const actualizada = await fetch(`/api/salones/${salonId}/asistencia?fecha=${fecha}`).then((r) => r.json());
      setRegistro(actualizada);
      setEstados(Object.fromEntries(actualizada.alumnos.map((alumno) => [alumno.estudiante_id, alumno.estado || ''])));
      setMotivos(Object.fromEntries(actualizada.alumnos.map((alumno) => [alumno.estudiante_id, alumno.motivo || ''])));
      setArchivos({});
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setGuardando(false);
    }
  }

  async function guardarRegla() {
    setGuardandoRegla(true);
    setError('');
    try {
      const respuesta = await fetch('/api/configuracion/asistencia', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tardanzasPorInasistencia: Number(umbralTardanzas) }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo actualizar la regla.');
      setMensaje(datos.mensaje);
      await onGuardado();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setGuardandoRegla(false);
    }
  }

  function leerAdjunto(estudianteId, archivo) {
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => setArchivos((actuales) => ({
      ...actuales,
      [estudianteId]: { nombre: archivo.name, tipo: archivo.type, base64: lector.result },
    }));
    lector.readAsDataURL(archivo);
  }

  return (
    <section id="asistencia" className="attendance-section">
      <SectionHeading eyebrow="Control de aula" title="Asistencia por salón" trailing={<span className="period-chip"><Users size={13} /> {salones.length} salones · {totalSalones} estudiantes</span>} />
      <div className="attendance-panel">
        <div className="attendance-toolbar">
          <label className="attendance-control"><span>Salón</span>
            <select value={salonId} onChange={(evento) => setSalonId(evento.target.value)} aria-label="Elegir salón">
              {salones.map((salon) => <option key={salon.id} value={salon.id}>{salon.nombre} · {salon.grado} sección {salon.seccion}</option>)}
            </select>
          </label>
          <label className="attendance-control"><span>Fecha de asistencia</span><input type="date" value={fecha} onChange={(evento) => setFecha(evento.target.value)} /></label>
          <label className="attendance-search"><Search size={15} /><input value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Buscar alumno" aria-label="Buscar alumno" /></label>
        </div>

        <div className="attendance-summary">
          <div className="attendance-count count-present"><span>Asistencia</span><strong>{resumenEnVivo.Presente}</strong></div>
          <div className="attendance-count count-absent"><span>Inasistencia</span><strong>{resumenEnVivo.Ausente}</strong></div>
          <div className="attendance-count count-late"><span>Tardanza</span><strong>{resumenEnVivo.Tardanza}</strong></div>
          <div className="attendance-count count-excused"><span>Justificados</span><strong>{resumenEnVivo.Justificado}</strong></div>
          <div className="attendance-count count-pending"><span>Pendientes</span><strong>{resumenEnVivo.pendientes}</strong></div>
        </div>

        <div className="attendance-actions">
          {!soloLectura && <div className="bulk-actions"><span>Marcar grupo:</span>
            <button type="button" onClick={() => marcarTodos('Presente')}>Todos presentes</button>
            <button type="button" onClick={() => marcarTodos('Ausente')}>Todos ausentes</button>
          </div>}
          {!soloLectura && <Button type="button" onClick={guardarAsistencia} disabled={guardando || cargando || cantidadMarcados === 0}>
            <Check size={15} /> {guardando ? 'Guardando...' : `Guardar ${cantidadMarcados} registros`}
          </Button>}
        </div>

        {puedeConfigurar && <div className="tardy-rule">
          <span><Clock3 size={15} /> Regla institucional: cada</span>
          <select value={umbralTardanzas} onChange={(evento) => setUmbralTardanzas(Number(evento.target.value))} aria-label="Tardanzas por falta equivalente">
            {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((cantidad) => <option key={cantidad} value={cantidad}>{cantidad}</option>)}
          </select>
          <span>tardanzas equivalen a una falta</span>
          <Button type="button" variant="secondary" onClick={guardarRegla} disabled={guardandoRegla}>{guardandoRegla ? 'Aplicando...' : 'Aplicar regla'}</Button>
        </div>}

        {error && <p className="attendance-feedback feedback-error" role="alert">{error}</p>}
        {mensaje && <p className="attendance-feedback feedback-success" role="status">{mensaje}</p>}
        {cargando ? <div className="attendance-loading">Cargando lista del salón...</div> : (
          <div className="attendance-roster-scroll">
            <table className="attendance-roster">
              <thead><tr><th>N.º</th><th>Alumno</th><th>Riesgo</th><th>Asistencia acumulada</th><th>Estado del día</th><th>Motivo / respaldo</th></tr></thead>
              <tbody>
                {alumnosFiltrados.map((alumno, indice) => (
                  <tr key={alumno.estudiante_id}>
                    <td className="roster-index">{String(indice + 1).padStart(2, '0')}</td>
                    <td><div className="roster-student"><span className="student-avatar">{alumno.nombre.split(' ').map((parte) => parte[0]).slice(0, 2).join('')}</span><span><strong>{alumno.nombre}</strong><small>{alumno.codigo} · {alumno.tutor}</small></span></div></td>
                    <td><RiskBadge nivel={alumno.nivel_riesgo} /></td>
                    <td><span className={alumno.asistencia_acumulada < 75 ? 'value-warning' : ''}>{alumno.asistencia_acumulada}%</span></td>
                    <td><select disabled={soloLectura} className={`attendance-status status-${(estados[alumno.estudiante_id] || 'pendiente').toLowerCase()}`} value={estados[alumno.estudiante_id] || ''} onChange={(evento) => { setEstados((actual) => ({ ...actual, [alumno.estudiante_id]: evento.target.value })); setMensaje(''); }} aria-label={`Estado de asistencia de ${alumno.nombre}`}>
                      <option value="">Sin marcar</option>
                      {opcionesEstado.map((opcion) => <option key={opcion.valor} value={opcion.valor}>{opcion.texto}</option>)}
                    </select></td>
                    <td className="justification-cell">{estados[alumno.estudiante_id] === 'Justificado' && <>
                      <input disabled={soloLectura} value={motivos[alumno.estudiante_id] || ''} onChange={(evento) => setMotivos((actual) => ({ ...actual, [alumno.estudiante_id]: evento.target.value }))} placeholder="Motivo requerido" maxLength="500" aria-label={`Motivo de justificación de ${alumno.nombre}`} />
                      {!soloLectura && <label className="attachment-picker"><FileUp size={13} /><span>{archivos[alumno.estudiante_id]?.nombre || alumno.archivo_nombre || 'Adjuntar PDF/PNG/JPG'}</span><input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(evento) => leerAdjunto(alumno.estudiante_id, evento.target.files?.[0])} aria-label={`Adjuntar justificación de ${alumno.nombre}`} /></label>}
                    </>}</td>
                  </tr>
                ))}
                {!alumnosFiltrados.length && <tr><td colSpan="6" className="empty-state">No hay alumnos que coincidan con la búsqueda.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <footer className="attendance-footer"><span><ClipboardCheck size={14} /> {registro?.salon.nombre || 'Salón'} · {registro?.resumen.estudiantes || 0} estudiantes</span><span>{soloLectura ? 'Vista de tutor · solo lectura' : `Cada ${umbralTardanzas} tardanzas reducen la asistencia acumulada`}</span></footer>
      </div>
    </section>
  );
}
