import { motion } from 'framer-motion';
import { Activity, CalendarDays, GraduationCap, RotateCcw, TriangleAlert } from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { MetricCard, SectionHeading } from './Ui.jsx';
import { Card } from './ui/card.jsx';

const formatoFecha = (fecha) => new Date(`${fecha}T12:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });

export default function PanelDashboard({ resumen, evolucion, rol, salones, cursos, filtros, onCambioFiltro }) {
  const cursosVisibles = cursos.filter((curso) => !filtros.salon || String(curso.salon_id) === filtros.salon);
  const metricas = [
    { icon: GraduationCap, label: 'Estudiantes activos', value: resumen?.estudiantes ?? '—', note: 'Matrícula vigente', accent: 'green' },
    { icon: Activity, label: 'Promedio general', value: resumen?.promedio ? `${resumen.promedio}/20` : '—', note: 'Avance del período', accent: 'blue' },
    { icon: CalendarDays, label: 'Asistencia media', value: resumen?.asistencia ? `${resumen.asistencia}%` : '—', note: 'Registro actualizado', accent: 'amber' },
    { icon: TriangleAlert, label: 'Riesgo alto', value: resumen?.riesgo_alto ?? '—', note: 'Requieren seguimiento', accent: 'red' },
  ];

  return (
    <section id="resumen" className="dashboard-section">
      <SectionHeading
        eyebrow={`Vista ${rol} · Trujillo, Perú`}
        title="Panorama académico"
        trailing={<span className="period-chip"><span className="live-dot" /> Período 2026</span>}
      />
      <div className="dashboard-filters">
        <label><span>Aula</span><select value={filtros.salon} onChange={(evento) => onCambioFiltro('salon', evento.target.value)}>
          <option value="">Todas las aulas</option>
          {salones.map((salon) => <option key={salon.id} value={salon.id}>{salon.nombre}</option>)}
        </select></label>
        <label><span>Curso</span><select value={filtros.curso} onChange={(evento) => onCambioFiltro('curso', evento.target.value)}>
          <option value="">Todos los cursos</option>
          {cursosVisibles.map((curso) => <option key={curso.id} value={curso.id}>{curso.nombre}{!filtros.salon ? ` · ${curso.salon}` : ''}</option>)}
        </select></label>
        <label><span>Desde</span><input type="date" value={filtros.desde} max={filtros.hasta || undefined} onChange={(evento) => onCambioFiltro('desde', evento.target.value)} /></label>
        <label><span>Hasta</span><input type="date" value={filtros.hasta} min={filtros.desde || undefined} onChange={(evento) => onCambioFiltro('hasta', evento.target.value)} /></label>
        <button className="icon-button dashboard-filter-reset" type="button" onClick={() => onCambioFiltro('restablecer', '')} aria-label="Limpiar filtros" title="Limpiar filtros"><RotateCcw size={15} /></button>
      </div>
      <div className="metric-grid">
        {metricas.map((metrica, index) => (
          <motion.div key={metrica.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: index * 0.07 }}>
            <MetricCard {...metrica} delay={index * 70} />
          </motion.div>
        ))}
      </div>
      <Card className="chart-panel trend-panel">
        <div className="chart-heading">
          <div>
            <p className="eyebrow">Rendimiento</p>
            <h3>Progreso de calificaciones</h3>
          </div>
          <span className="chart-key"><i /> Promedio por evaluación</span>
        </div>
        <div className="trend-chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={evolucion} margin={{ top: 12, right: 10, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="areaPromedio" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#167d62" stopOpacity={0.16} />
                  <stop offset="95%" stopColor="#167d62" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5" />
              <XAxis dataKey="fecha" tickFormatter={formatoFecha} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} dy={8} />
              <YAxis domain={[0, 20]} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
              <Tooltip labelFormatter={formatoFecha} formatter={(valor) => [`${valor}/20`, 'Promedio']} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--ink)' }} />
              <Area type="monotone" dataKey="promedio" stroke="#167d62" strokeWidth={2.5} fill="url(#areaPromedio)" activeDot={{ r: 5, fill: '#167d62', stroke: 'var(--surface)', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </section>
  );
}
