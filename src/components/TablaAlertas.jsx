import { useDeferredValue, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { RiskBadge, SectionHeading } from './Ui.jsx';

export default function TablaAlertas({ predicciones, cursos, salones, onAbrirFicha }) {
  const [busqueda, setBusqueda] = useState('');
  const [nivel, setNivel] = useState('Todos');
  const [salon, setSalon] = useState(String(salones[0]?.id || 'Todos'));
  const [curso, setCurso] = useState('');
  const consulta = useDeferredValue(busqueda.trim().toLocaleLowerCase('es'));
  const cursosDelSalon = cursos.filter((opcion) => salon === 'Todos' || String(opcion.salon_id) === salon);
  const cursoSeleccionado = curso || String(cursosDelSalon[0]?.id || 'Todos');
  const filas = predicciones.filter((fila) => {
    const coincideTexto = `${fila.estudiante} ${fila.curso} ${fila.codigo}`.toLocaleLowerCase('es').includes(consulta);
    return coincideTexto
      && (salon === 'Todos' || String(fila.salon_id) === salon)
      && (nivel === 'Todos' || fila.nivel === nivel)
      && (cursoSeleccionado === 'Todos' || String(fila.curso_id) === cursoSeleccionado);
  });

  return (
    <section id="alertas" className="table-section">
      <SectionHeading eyebrow="Priorización pedagógica" title="Alertas de seguimiento" />
      <div className="table-toolbar">
        <label className="filter-field"><span className="sr-only">Filtrar por salón</span>
          <select value={salon} onChange={(evento) => { setSalon(evento.target.value); setCurso(''); }} aria-label="Filtrar por salón">
            {salones.length > 1 && <option value="Todos">Todos los salones</option>}
            {salones.map((opcion) => <option key={opcion.id} value={opcion.id}>{opcion.nombre}</option>)}
          </select>
        </label>
        <label className="filter-field"><span className="sr-only">Filtrar por curso</span>
          <select value={cursoSeleccionado} onChange={(evento) => setCurso(evento.target.value)} aria-label="Filtrar por curso">
            <option value="Todos">Todos los cursos</option>
            {cursosDelSalon.map((opcion) => <option key={opcion.id} value={opcion.id}>{opcion.nombre}</option>)}
          </select>
        </label>
        <label className="search-field">
          <Search size={16} />
          <input value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Buscar estudiante o curso" aria-label="Buscar estudiante o curso" />
        </label>
        <label className="filter-field"><SlidersHorizontal size={15} /><span className="sr-only">Filtrar por nivel</span>
          <select value={nivel} onChange={(evento) => setNivel(evento.target.value)} aria-label="Filtrar por nivel de riesgo">
            <option>Todos</option><option>Alto</option><option>Medio</option><option>Bajo</option>
          </select>
        </label>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Estudiante</th><th>Curso</th><th>Asistencia</th><th>Promedio</th><th>Riesgo</th><th>Recomendación prioritaria</th></tr></thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.id}>
                <td><div className="student-cell"><span className="student-avatar">{fila.estudiante.split(' ').map((parte) => parte[0]).slice(0, 2).join('')}</span><span><button className="student-profile-link" type="button" onClick={() => onAbrirFicha(fila.estudiante_id)}>{fila.estudiante}</button><small>{fila.codigo}</small></span></div></td>
                <td><span className="course-name">{fila.curso}</span><small className="cell-subtitle">{fila.grado} · {fila.seccion}</small></td>
                <td><span className={fila.asistencia < 75 ? 'value-warning' : ''}>{fila.asistencia}%</span></td>
                <td><span className={fila.promedio < 11 ? 'value-warning' : ''}>{fila.promedio}/20</span></td>
                <td><RiskBadge nivel={fila.nivel} /><small className="risk-score">Puntaje {fila.puntaje}/100</small></td>
                <td className="recommendation-cell">{fila.recomendaciones[0]}</td>
              </tr>
            ))}
            {filas.length === 0 && <tr><td className="empty-state" colSpan="6">No hay alertas que coincidan con esos filtros.</td></tr>}
          </tbody>
        </table>
      </div>
      <footer className="table-footer"><span>Predicción basada en notas, asistencia, entregas y conducta</span><span>Actualización automática</span></footer>
    </section>
  );
}
