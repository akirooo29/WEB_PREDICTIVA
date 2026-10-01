import { useEffect, useState } from 'react';
import { CalendarPlus, Phone, Send, UsersRound } from 'lucide-react';
import { Button, SectionHeading } from './Ui.jsx';

const fechaLocal = () => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
};

export default function SeguimientoFamilias({ estudiantes, soloLectura = false }) {
  const [estudianteId, setEstudianteId] = useState(String(estudiantes[0]?.id || ''));
  const [tipo, setTipo] = useState('Llamada');
  const [resultado, setResultado] = useState('Completado');
  const [nota, setNota] = useState('');
  const [proximoContacto, setProximoContacto] = useState('');
  const [seguimientos, setSeguimientos] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  async function cargarSeguimientos() {
    const respuesta = await fetch('/api/seguimientos-familia');
    const datos = await respuesta.json();
    if (!respuesta.ok) throw new Error(datos.error || 'No se pudo cargar el seguimiento familiar.');
    setSeguimientos(datos);
  }

  useEffect(() => { cargarSeguimientos().catch((fallo) => setError(fallo.message)); }, []);

  async function registrar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setError('');
    setMensaje('');
    try {
      const respuesta = await fetch('/api/seguimientos-familia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estudianteId: Number(estudianteId), tipo, resultado, nota, proximoContacto: proximoContacto || null }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo guardar el contacto.');
      setMensaje(datos.mensaje);
      setNota('');
      setProximoContacto('');
      await cargarSeguimientos();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section id="seguimiento" className="followup-section">
      <SectionHeading eyebrow="Acompañamiento" title="Seguimiento a familias" trailing={<span className="period-chip"><Phone size={13} /> Registro local</span>} />
      <div className="followup-grid">
        {!soloLectura && <form className="followup-form" onSubmit={registrar}>
          <div className="form-title"><span className="form-icon form-icon-green"><UsersRound size={17} /></span><div><h3>Registrar contacto</h3><p>Deja constancia y agenda un próximo paso.</p></div></div>
          <label>Estudiante<select value={estudianteId} onChange={(evento) => setEstudianteId(evento.target.value)} required>{estudiantes.map((estudiante) => <option key={estudiante.id} value={estudiante.id}>{estudiante.nombre} · {estudiante.codigo}</option>)}</select></label>
          <div className="form-row">
            <label>Canal<select value={tipo} onChange={(evento) => setTipo(evento.target.value)}><option>Llamada</option><option>Mensaje</option><option>Reunión</option><option>Observación</option></select></label>
            <label>Resultado<select value={resultado} onChange={(evento) => setResultado(evento.target.value)}><option>Completado</option><option>Pendiente</option></select></label>
          </div>
          <label>Acuerdo o nota<textarea value={nota} onChange={(evento) => setNota(evento.target.value)} maxLength="1000" rows="3" placeholder="Resumen del contacto, acuerdos y apoyos requeridos" required /></label>
          <label className="next-contact-label"><CalendarPlus size={14} /> Próximo contacto<input type="date" min={fechaLocal()} value={proximoContacto} onChange={(evento) => setProximoContacto(evento.target.value)} /></label>
          <Button type="submit" disabled={guardando || !estudianteId}><Send size={14} /> {guardando ? 'Guardando...' : 'Guardar seguimiento'}</Button>
          {mensaje && <p className="form-feedback feedback-success" role="status">{mensaje}</p>}
          {error && <p className="form-feedback feedback-error" role="alert">{error}</p>}
        </form>}
        <article className="followup-history">
          <div className="followup-history-heading"><div><p className="eyebrow">Bitácora familiar</p><h3>Contactos recientes</h3></div><span>{seguimientos.length}</span></div>
          {error && soloLectura && <p className="form-feedback feedback-error" role="alert">{error}</p>}
          <div className="followup-list">
            {seguimientos.map((item) => (
              <div className="followup-item" key={item.id}>
                <span className={`followup-type type-${item.tipo.toLowerCase()}`}>{item.tipo === 'Llamada' ? <Phone size={14} /> : <UsersRound size={14} />}</span>
                <div className="followup-item-body"><div className="followup-item-top"><strong>{item.estudiante}</strong><time>{new Date(item.registrado_en.replace(' ', 'T')).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })}</time></div><p>{item.nota}</p><small>{item.tipo} · {item.registrado_por}{item.proximo_contacto ? ` · Próximo: ${item.proximo_contacto}` : ''}</small></div>
                <span className={`followup-status ${item.resultado === 'Completado' ? 'followup-done' : 'followup-pending'}`}>{item.resultado}</span>
              </div>
            ))}
            {!seguimientos.length && <div className="followup-empty">No hay contactos registrados todavía.</div>}
          </div>
        </article>
      </div>
    </section>
  );
}
