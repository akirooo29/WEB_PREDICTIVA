import { useState } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Button, SectionHeading } from './Ui.jsx';

const exportaciones = [
  { valor: 'alumnos', nombre: 'Matrícula de alumnos' },
  { valor: 'notas', nombre: 'Notas por curso' },
  { valor: 'asistencia', nombre: 'Asistencia diaria' },
];

export default function ImportarExportar({ soloLectura = false, onImportado }) {
  const [archivo, setArchivo] = useState(null);
  const [tipoExportacion, setTipoExportacion] = useState('alumnos');
  const [importando, setImportando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [errores, setErrores] = useState([]);
  const [error, setError] = useState('');

  async function importarNotas(evento) {
    evento.preventDefault();
    if (!archivo) return;
    const formulario = evento.currentTarget;
    setImportando(true);
    setMensaje('');
    setErrores([]);
    setError('');
    try {
      const respuesta = await fetch('/api/importaciones/notas', {
        method: 'POST', headers: { 'Content-Type': 'text/csv; charset=utf-8' },
        body: await archivo.text(),
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok) {
        setErrores(resultado.errores || []);
        throw new Error(resultado.error || 'No se pudo importar el CSV.');
      }
      setMensaje(resultado.mensaje);
      setArchivo(null);
      formulario.reset();
      await onImportado();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setImportando(false);
    }
  }

  return (
    <section id="datos" className="data-tools-section">
      <SectionHeading eyebrow="Gestión local de datos" title="Importación y respaldos" trailing={<span className="period-chip"><FileSpreadsheet size={13} /> PDF</span>} />
      <div className="data-tools-grid">
        {!soloLectura && <form className="data-tool" onSubmit={importarNotas}>
          <div className="form-title"><span className="form-icon form-icon-green"><Upload size={16} /></span><div><h3>Importar notas</h3><p>CSV con validación antes de guardar.</p></div></div>
          <label className="data-file-label">Archivo CSV<input type="file" accept=".csv,text/csv" onChange={(evento) => { setArchivo(evento.target.files?.[0] || null); setMensaje(''); setError(''); setErrores([]); }} /></label>
          <div className="data-tool-actions"><a href="/api/plantillas/notas.csv" className="data-template-link">Descargar plantilla</a><Button type="submit" disabled={!archivo || importando}><Upload size={14} /> {importando ? 'Importando...' : 'Importar notas'}</Button></div>
        </form>}
        <article className="data-tool">
          <div className="form-title"><span className="form-icon form-icon-amber"><Download size={16} /></span><div><h3>Exportar respaldo</h3><p>Descarga datos disponibles en PDF.</p></div></div>
          <label className="data-file-label">Conjunto de datos<select value={tipoExportacion} onChange={(evento) => setTipoExportacion(evento.target.value)}>{exportaciones.map((opcion) => <option key={opcion.valor} value={opcion.valor}>{opcion.nombre}</option>)}</select></label>
          <div className="data-tool-actions">
            <span className="data-local-note">Documento PDF local</span>
            <a className="button button-secondary" href={`/api/exportaciones/${tipoExportacion}.pdf`}><Download size={14} /> Descargar PDF</a>
          </div>
        </article>
      </div>
      {mensaje && <p className="form-feedback feedback-success" role="status">{mensaje}</p>}
      {error && <p className="form-feedback feedback-error" role="alert">{error}</p>}
      {!!errores.length && <ul className="import-errors">{errores.slice(0, 20).map((detalle, indice) => <li key={`${indice}-${detalle}`}>{detalle}</li>)}</ul>}
    </section>
  );
}
