import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Plus } from 'lucide-react';
import { Button, SectionHeading } from './Ui.jsx';

export default function RegistroAcademico({ salones, estudiantes, onGuardado }) {
  const [salonId, setSalonId] = useState(String(salones[0]?.id || ''));
  const alumnosSalon = useMemo(() => estudiantes.filter((fila) => String(fila.salon_id) === salonId), [estudiantes, salonId]);
  const [estudianteId, setEstudianteId] = useState(String(alumnosSalon[0]?.id || ''));
  const [cursos, setCursos] = useState([]);
  const [cursoId, setCursoId] = useState('');
  const [evaluacion, setEvaluacion] = useState('Evaluación de unidad');
  const [calificacion, setCalificacion] = useState('');
  const [entregaATiempo, setEntregaATiempo] = useState(true);
  const [estadoEnvio, setEstadoEnvio] = useState({ tipo: '', texto: '' });
  const [guardando, setGuardando] = useState(false);

  const estudiante = alumnosSalon.find((fila) => String(fila.id) === estudianteId);
  const curso = cursos.find((fila) => String(fila.id) === cursoId);

  useEffect(() => {
    if (alumnosSalon.some((fila) => String(fila.id) === estudianteId)) return;
    setEstudianteId(String(alumnosSalon[0]?.id || ''));
    setCursoId('');
  }, [alumnosSalon, estudianteId]);

  useEffect(() => {
    if (!estudianteId) { setCursos([]); setCursoId(''); return undefined; }
    let vigente = true;
    fetch(`/api/estudiantes/${estudianteId}/cursos`)
      .then(async (respuesta) => {
        const datos = await respuesta.json();
        if (!respuesta.ok) throw new Error(datos.error || 'No se pudieron cargar las materias del alumno.');
        return datos;
      })
      .then((datos) => {
        if (!vigente) return;
        setCursos(datos);
        setCursoId((actual) => datos.some((opcion) => String(opcion.id) === actual) ? actual : String(datos[0]?.id || ''));
      })
      .catch((error) => setEstadoEnvio({ tipo: 'error', texto: error.message }));
    return () => { vigente = false; };
  }, [estudianteId]);

  async function enviar(endpoint, cuerpo) {
    setGuardando(true);
    setEstadoEnvio({ tipo: '', texto: '' });
    try {
      const respuesta = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok) throw new Error(resultado.error || 'No fue posible guardar el registro.');
      setEstadoEnvio({ tipo: 'success', texto: resultado.mensaje });
      await onGuardado();
      return true;
    } catch (error) {
      setEstadoEnvio({ tipo: 'error', texto: error.message });
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function registrarNota(evento) {
    evento.preventDefault();
    const guardado = await enviar('/api/notas', {
      estudianteId: Number(estudianteId), cursoId: Number(cursoId),
      calificacion: Number(calificacion), evaluacion, entregaATiempo,
    });
    if (guardado) setCalificacion('');
  }

  return (
    <section id="registro" className="record-section">
      <SectionHeading eyebrow="Registro académico" title="Notas por salón" trailing={<span className="period-chip">Ciclo 2026</span>} />
      <div className="record-student-bar">
        <label className="record-filter"><span>Salón</span><select value={salonId} onChange={(evento) => { setSalonId(evento.target.value); const primero = estudiantes.find((fila) => String(fila.salon_id) === evento.target.value); setEstudianteId(String(primero?.id || '')); setCursoId(''); }}>
          {salones.map((salon) => <option key={salon.id} value={salon.id}>{salon.nombre}</option>)}
        </select></label>
        <label className="record-filter"><span>Estudiante</span><select value={estudianteId} onChange={(evento) => { setEstudianteId(evento.target.value); setCursoId(''); }} disabled={!alumnosSalon.length}>
          {alumnosSalon.map((fila) => <option key={fila.id} value={fila.id}>{fila.nombre} · {fila.codigo}</option>)}
        </select></label>
        <label className="record-filter"><span>Curso</span><select value={cursoId} onChange={(evento) => setCursoId(evento.target.value)} disabled={!cursos.length}>
          {cursos.map((opcion) => <option key={opcion.id} value={opcion.id}>{opcion.nombre}</option>)}
        </select></label>
      </div>
      <div className="record-grid record-grid-single">
        <form className="record-form" onSubmit={registrarNota}>
          <div className="form-title"><span className="form-icon form-icon-green"><ClipboardList size={17} /></span><div><h3>{curso?.nombre || 'Registrar calificación'}</h3><p>{estudiante ? `${estudiante.nombre} · ${curso?.grado || estudiante.grado} ${curso?.seccion || estudiante.seccion}` : 'Elige un salón y estudiante.'}</p></div></div>
          <label>Evaluación<input value={evaluacion} onChange={(evento) => setEvaluacion(evento.target.value)} maxLength="80" required /></label>
          <div className="form-row">
            <label>Nota sobre 20<input type="number" min="0" max="20" step="0.5" value={calificacion} onChange={(evento) => setCalificacion(evento.target.value)} placeholder="0 – 20" required /></label>
            <label className="checkbox-label"><input type="checkbox" checked={entregaATiempo} onChange={(evento) => setEntregaATiempo(evento.target.checked)} /> Entrega a tiempo</label>
          </div>
          <Button type="submit" disabled={guardando || !estudiante || !cursoId}><Plus size={15} /> Guardar nota</Button>
        </form>
      </div>
      {estadoEnvio.texto && <p className={`form-feedback feedback-${estadoEnvio.tipo}`} role="status">{estadoEnvio.texto}</p>}
    </section>
  );
}
