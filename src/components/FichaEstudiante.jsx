import { useEffect, useState } from 'react';
import { CalendarDays, Check, Clock3, FileText, GraduationCap, UserRound, X } from 'lucide-react';
import { RiskBadge } from './Ui.jsx';

const fechaBonita = (fecha) => new Date(`${fecha}T12:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });

export default function FichaEstudiante({ estudianteId, onCerrar }) {
  const [ficha, setFicha] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    fetch(`/api/estudiantes/${estudianteId}/ficha`)
      .then(async (respuesta) => {
        const datos = await respuesta.json();
        if (!respuesta.ok) throw new Error(datos.error || 'No se pudo cargar la ficha.');
        return datos;
      })
      .then((datos) => { if (vigente) setFicha(datos); })
      .catch((fallo) => { if (vigente) setError(fallo.message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [estudianteId]);

  useEffect(() => {
    function cerrarConEscape(evento) {
      if (evento.key === 'Escape') onCerrar();
    }
    window.addEventListener('keydown', cerrarConEscape);
    return () => window.removeEventListener('keydown', cerrarConEscape);
  }, [onCerrar]);

  return (
    <div className="profile-overlay" onMouseDown={(evento) => { if (evento.target === evento.currentTarget) onCerrar(); }}>
      <section className="student-profile" role="dialog" aria-modal="true" aria-labelledby="student-profile-title">
        <header className="profile-header">
          <span className="profile-avatar"><UserRound size={21} /></span>
          <div className="profile-heading">
            <p className="eyebrow">Ficha académica individual</p>
            <h2 id="student-profile-title">{ficha?.estudiante.nombre || 'Cargando ficha'}</h2>
            {ficha?.estudiante && <span>{ficha.estudiante.codigo} · {ficha.estudiante.salon} · Tutor: {ficha.estudiante.usuario_tutor || ficha.estudiante.tutor}</span>}
          </div>
          <button className="icon-button profile-close" onClick={onCerrar} aria-label="Cerrar ficha"><X size={19} /></button>
        </header>

        {error && <p className="attendance-feedback feedback-error" role="alert">{error}</p>}
        {cargando ? <div className="profile-loading">Cargando trayectoria académica...</div> : ficha && <div className="profile-content">
          <section className="profile-section">
            <div className="profile-section-title"><GraduationCap size={16} /><h3>Resumen por curso</h3></div>
            <div className="profile-course-grid">
              {ficha.cursos.map((curso) => (
                <article className="profile-course" key={curso.id}>
                  <div className="profile-course-heading"><strong>{curso.nombre}</strong><RiskBadge nivel={curso.nivel} /></div>
                  <div className="profile-course-metrics"><span>Promedio <strong>{curso.promedio ?? '—'}/20</strong></span><span>Asistencia <strong>{curso.asistencia ?? '—'}%</strong></span></div>
                  <small>{curso.recomendaciones[0] || 'Sin recomendación pendiente.'}</small>
                </article>
              ))}
            </div>
          </section>

          <div className="profile-columns">
            <section className="profile-section">
              <div className="profile-section-title"><FileText size={15} /><h3>Últimas calificaciones</h3></div>
              <div className="profile-list">
                {ficha.notas.map((nota) => <div className="profile-row" key={nota.id}><span><strong>{nota.evaluacion}</strong><small>{nota.curso} · {fechaBonita(nota.fecha)}</small></span><b className={nota.calificacion < 11 ? 'value-warning' : ''}>{nota.calificacion}/20</b></div>)}
                {!ficha.notas.length && <p className="profile-empty">Aún no hay notas registradas.</p>}
              </div>
            </section>
            <section className="profile-section">
              <div className="profile-section-title"><Clock3 size={15} /><h3>Asistencia reciente</h3></div>
              <div className="profile-list">
                {ficha.asistencias.map((asistencia, indice) => <div className="profile-row" key={`${asistencia.fecha}-${asistencia.curso}-${indice}`}><span><strong>{asistencia.estado}</strong><small>{asistencia.curso} · {fechaBonita(asistencia.fecha)}</small></span><span className={`attendance-mini attendance-${asistencia.estado.toLowerCase()}`}><Check size={12} /></span></div>)}
                {!ficha.asistencias.length && <p className="profile-empty">Aún no hay asistencia registrada.</p>}
              </div>
            </section>
          </div>

          <section className="profile-section">
            <div className="profile-section-title"><CalendarDays size={15} /><h3>Seguimiento familiar</h3></div>
            <div className="profile-list">
              {ficha.seguimientos.map((seguimiento) => <div className="profile-row profile-followup" key={seguimiento.id}><span><strong>{seguimiento.tipo} · {seguimiento.resultado}</strong><small>{fechaBonita(seguimiento.registrado_en.slice(0, 10))} · {seguimiento.registrado_por}</small><p>{seguimiento.nota}</p></span>{seguimiento.proximo_contacto && <small>Próximo: {fechaBonita(seguimiento.proximo_contacto)}</small>}</div>)}
              {!ficha.seguimientos.length && <p className="profile-empty">Aún no hay contactos registrados.</p>}
            </div>
          </section>
        </div>}
      </section>
    </div>
  );
}
