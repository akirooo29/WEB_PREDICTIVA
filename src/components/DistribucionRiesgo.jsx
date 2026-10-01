import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { SectionHeading } from './Ui.jsx';
import { Card } from './ui/card.jsx';

const colores = { Alto: '#c8453d', Medio: '#d89624', Bajo: '#168365' };

export default function DistribucionRiesgo({ predicciones }) {
  const prioridad = { Bajo: 1, Medio: 2, Alto: 3 };
  const riesgoPorEstudiante = new Map();
  predicciones.forEach((fila) => {
    const actual = riesgoPorEstudiante.get(fila.estudiante_id);
    if (!actual || prioridad[fila.nivel] > prioridad[actual]) riesgoPorEstudiante.set(fila.estudiante_id, fila.nivel);
  });
  const datos = ['Alto', 'Medio', 'Bajo'].map((nivel) => ({
    name: nivel,
    value: [...riesgoPorEstudiante.values()].filter((riesgo) => riesgo === nivel).length,
  }));
  const total = datos.reduce((suma, dato) => suma + dato.value, 0);

  return (
    <Card className="chart-panel risk-chart-panel">
      <SectionHeading eyebrow="Alertas tempranas" title="Distribución de riesgo" />
      <div className="risk-chart-layout">
        <div className="risk-donut">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={datos} dataKey="value" nameKey="name" innerRadius="69%" outerRadius="92%" paddingAngle={3} stroke="none">
                {datos.map((dato) => <Cell key={dato.name} fill={colores[dato.name]} />)}
              </Pie>
              <Tooltip formatter={(valor, nombre) => [`${valor} estudiantes`, nombre]} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--ink)' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-center"><strong>{total}</strong><span>estudiantes</span></div>
        </div>
        <div className="risk-legend">
          {datos.map((dato) => (
            <div className="legend-row" key={dato.name}>
              <span className="legend-name"><i style={{ backgroundColor: colores[dato.name] }} />{dato.name}</span>
              <strong>{dato.value}</strong>
              <span className="legend-percent">{total ? Math.round(dato.value / total * 100) : 0}%</span>
            </div>
          ))}
          <p className="chart-footnote">Clasificación calculada con datos registrados</p>
        </div>
      </div>
    </Card>
  );
}
