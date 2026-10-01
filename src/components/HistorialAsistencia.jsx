import { useEffect, useState } from 'react';
import { Download, FileClock, FileText, Search } from 'lucide-react';
import { SectionHeading } from './Ui.jsx';

const fechaLocal = () => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
};
const fechaInicio = () => `${fechaLocal().slice(0, 4)}-${fechaLocal().slice(5, 7)}-01`;

export default function HistorialAsistencia({ salones, estudiantes }) {
  const [salonId, setSalonId] = useState('Todos');
  const [estudianteId, setEstudianteId] = useState('Todos');
  const [desde, setDesde] = useState(fechaInicio);
  const [hasta, setHasta] = useState(fechaLocal);
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const filtrosReporte = new URLSearchParams({ desde, hasta });
  if (salonId !== 'Todos') filtrosReporte.set('salonId', salonId);
  if (estudianteId !== 'Todos') filtrosReporte.set('estudianteId', estudianteId);
  const urlReporte = `/api/reportes/historial.pdf?${filtrosReporte}`;

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    const filtros = new URLSearchParams({ desde, hasta });
    if (salonId !== 'Todos') filtros.set('salonId', salonId);
    if (estudianteId !== 'Todos') filtros.set('estudianteId', estudianteId);
    fetch(`/api/historial-asistencia?${filtros}`)
      .then(async (respuesta) => {
        const datos = await respuesta.json();
        if (!respuesta.ok) throw new Error(datos.error || 'No se pudo consultar el historial.');
        return datos;
      })
      .then((datos) => { if (vigente) { setHistorial(datos); setError(''); } })
      .catch((fallo) => { if (vigente) setError(fallo.message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [desde, hasta, salonId, estudianteId]);

  return (
    <section id="historial" className="history-section">
      <SectionHeading eyebrow="Trazabilidad" title="Historial y reportes" trailing={<a className="button button-secondary history-download" href={urlReporte}><Download size={14} /> Exportar PDF</a>} />
      <div className="history-panel">
        <div className="history-filters">
          <label>Desde<input type="date" value={desde} max={hasta} onChange={(evento) => setDesde(evento.target.value)} /></label>
          <label>Hasta<input type="date" value={hasta} min={desde} onChange={(evento) => setHasta(evento.target.value)} /></label>
          <label>Salón<select value={salonId} onChange={(evento) => setSalonId(evento.target.value)}><option value="Todos">Todos</option>{salones.map((salon) => <option key={salon.id} value={salon.id}>{salon.nombre}</option>)}</select></label>
          <label className="history-student-filter"><Search size={14} /><span className="sr-only">Filtrar estudiante</span><select value={estudianteId} onChange={(evento) => setEstudianteId(evento.target.value)}><option value="Todos">Todos los estudiantes</option>{estudiantes.map((estudiante) => <option key={estudiante.id} value={estudiante.id}>{estudiante.nombre}</option>)}</select></label>
        </div>
        {error && <p className="attendance-feedback feedback-error" role="alert">{error}</p>}
        <div className="history-table-scroll">
          <table className="history-table">
            <thead><tr><th>Fecha / hora</th><th>Estudiante</th><th>Salón</th><th>Cambio</th><th>Motivo</th><th>Registró</th><th>Adjunto</th></tr></thead>
            <tbody>
              {historial.map((cambio) => (
                <tr key={cambio.id}>
                  <td><strong>{new Date(`${cambio.fecha}T12:00:00`).toLocaleDateString('es-PE')}</strong><small>{cambio.registrado_en}</small></td>
                  <td><strong>{cambio.estudiante}</strong><small>{cambio.codigo}</small></td>
                  <td>{cambio.salon}</td>
                  <td><span className="history-change">{cambio.estado_anterior || 'Sin registro'} <span>→</span> <strong>{cambio.estado_nuevo}</strong></span></td>
                  <td className="history-reason">{cambio.motivo || '—'}</td>
                  <td>{cambio.registrado_por}</td>
                  <td>{cambio.tiene_archivo ? <a className="file-link" href={`/api/historial-asistencia/${cambio.id}/archivo`}><FileText size={14} />{cambio.archivo_nombre}</a> : '—'}</td>
                </tr>
              ))}
              {!cargando && !historial.length && <tr><td colSpan="7" className="empty-state">Aún no hay cambios registrados para este período.</td></tr>}
              {cargando && <tr><td colSpan="7" className="empty-state">Cargando historial...</td></tr>}
            </tbody>
          </table>
        </div>
        <footer className="history-footer"><span><FileClock size={14} /> {historial.length} eventos en el período</span></footer>
      </div>
    </section>
  );
}
