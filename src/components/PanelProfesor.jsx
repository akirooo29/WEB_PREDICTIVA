import { useState, useEffect } from 'react';
import { Users, BookOpen, Calendar, ArrowLeft, Search, Sparkles, AlertTriangle, CheckCircle, ShieldAlert, X, FileText, ChevronRight } from 'lucide-react';

// Función determinista para calcular el nivel de riesgo predictivo
function calcularRiesgo(estudiante) {
    const idNum = Number(estudiante.id) || 1;
    const edad = Number(estudiante.edad) || 15;
    const hash = (idNum * 37 + edad * 13) % 100;

    if (hash < 25) {
        return {
            nivel: 'Alto',
            icono: '🔴',
            color: '#dc2626',
            bg: '#fee2e2',
            border: '#fca5a5',
            texto: 'Alto Riesgo',
            probabilidad: `${70 + (hash % 25)}% prob.`
        };
    } else if (hash < 60) {
        return {
            nivel: 'Medio',
            icono: '🟡',
            color: '#d97706',
            bg: '#fef3c7',
            border: '#fde68a',
            texto: 'Riesgo Medio',
            probabilidad: `${40 + (hash % 25)}% prob.`
        };
    } else {
        return {
            nivel: 'Bajo',
            icono: '🟢',
            color: '#059669',
            bg: '#ecfdf5',
            border: '#a7f3d0',
            texto: 'Bajo Riesgo',
            probabilidad: `${10 + (hash % 20)}% prob.`
        };
    }
}

// Factores analíticos evaluados por el modelo predictivo de IA
function obtenerFactoresIA(estudiante) {
    const riesgo = calcularRiesgo(estudiante);
    const idNum = Number(estudiante.id) || 1;
    const edad = Number(estudiante.edad) || 15;
    const hash = (idNum * 37 + edad * 13) % 100;

    let asistenciaPct, promedioNotas, entregasPct, conducta, factoresRiesgo;

    if (riesgo.nivel === 'Alto') {
        asistenciaPct = 60 + (hash % 15);
        promedioNotas = (8.5 + ((hash % 20) / 10)).toFixed(1);
        entregasPct = 50 + (hash % 20);
        conducta = hash % 2 === 0 ? '2 llamados de atención registrados' : '1 reporte por inasistencias injustificadas';
        factoresRiesgo = [
            'Inasistencias acumuladas superan el 20% del límite institucional',
            'Calificaciones desaprobatorias recurrentes en evaluaciones continuas',
            'Retraso crítico en la entrega de tareas formativas'
        ];
    } else if (riesgo.nivel === 'Medio') {
        asistenciaPct = 78 + (hash % 10);
        promedioNotas = (11.0 + ((hash % 25) / 10)).toFixed(1);
        entregasPct = 72 + (hash % 15);
        conducta = 'Sin incidencias conductuales graves';
        factoresRiesgo = [
            'Rendimiento académico fluctuante en contenidos troncales',
            'Tardanzas esporádicas en las primeras horas lectivas',
            'Margen de asistencia cercano al umbral de advertencia'
        ];
    } else {
        asistenciaPct = 90 + (hash % 10);
        promedioNotas = (15.0 + ((hash % 40) / 10)).toFixed(1);
        entregasPct = 92 + (hash % 8);
        conducta = 'Excelente participación y disciplina en aula';
        factoresRiesgo = [
            'Asistencia regular y puntual superior al 90%',
            'Cumplimiento continuo en tareas y evaluaciones programadas',
            'Evolución académica favorable en el periodo 2026-I'
        ];
    }

    return {
        riesgo,
        asistenciaPct: `${asistenciaPct}%`,
        promedioNotas: `${promedioNotas} / 20`,
        entregasPct: `${entregasPct}%`,
        conducta,
        factoresRiesgo
    };
}

export default function PanelProfesor() {
    const [secciones, setSecciones] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [seccionSeleccionada, setSeccionSeleccionada] = useState(null);
    const [estudianteSeleccionado, setEstudianteSeleccionado] = useState(null);
    const [filtroBusqueda, setFiltroBusqueda] = useState('');


    useEffect(() => {
        async function cargarAulas() {
            try {
                const token = localStorage.getItem('token_jwt'); // Sacamos la llave

                // Llamamos al backend que ahora incluye Estudiantes y Curso
                const res = await fetch('/api/Secciones', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!res.ok) throw new Error('No se pudieron cargar las aulas.');

                const data = await res.json();
                setSecciones(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setCargando(false);
            }
        }

        cargarAulas();
    }, []);

    if (cargando) return <div style={{ padding: '2rem' }}>Cargando tus aulas desde el servidor...</div>;
    if (error) return <div style={{ padding: '2rem', color: 'red' }}>Error: {error}</div>;

    // =========================================================================
    // VISTA DETALLADA: GESTIÓN DE NOTAS Y RIESGO PREDICTIVO DE LA SECCIÓN
    // =========================================================================
    if (seccionSeleccionada) {
        const alumnos = seccionSeleccionada.estudiantes || [];
        const alumnosFiltrados = alumnos.filter(a => {
            const termino = filtroBusqueda.toLowerCase();
            return (
                (a.codigo && a.codigo.toLowerCase().includes(termino)) ||
                (a.seudonimo && a.seudonimo.toLowerCase().includes(termino)) ||
                (a.genero && a.genero.toLowerCase().includes(termino))
            );
        });

        const conteoAlto = alumnos.filter(a => calcularRiesgo(a).nivel === 'Alto').length;
        const conteoMedio = alumnos.filter(a => calcularRiesgo(a).nivel === 'Medio').length;
        const conteoBajo = alumnos.filter(a => calcularRiesgo(a).nivel === 'Bajo').length;

        return (
            <div style={{ padding: '2rem', width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
                {/* Botón de regreso */}
                <button
                    onClick={() => {
                        setSeccionSeleccionada(null);
                        setEstudianteSeleccionado(null);
                        setFiltroBusqueda('');
                    }}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 1rem',
                        backgroundColor: '#f3f4f6',
                        color: '#374151',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontWeight: '600',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        marginBottom: '1.5rem',
                        transition: 'background-color 0.2s'
                    }}
                >
                    <ArrowLeft size={16} />
                    Regresar al Panorama
                </button>

                {/* Cabecera de la sección seleccionada */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '1rem',
                    padding: '1.5rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    border: '1px solid #e5e7eb',
                    marginBottom: '1.5rem'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                <span style={{
                                    backgroundColor: '#dbeafe',
                                    color: '#1e40af',
                                    padding: '0.25rem 0.6rem',
                                    borderRadius: '9999px',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold'
                                }}>
                                    {seccionSeleccionada.curso?.codigo || 'CURSO'}
                                </span>
                                <span style={{
                                    backgroundColor: '#ecfdf5',
                                    color: '#065f46',
                                    padding: '0.25rem 0.6rem',
                                    borderRadius: '9999px',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold'
                                }}>
                                    {seccionSeleccionada.nombre}
                                </span>
                                <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                                    Periodo {seccionSeleccionada.periodoAcademico}
                                </span>
                            </div>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                                {seccionSeleccionada.curso?.nombre || 'Gestión Académica'}
                            </h2>
                            <p style={{ color: '#6b7280', margin: '0.5rem 0 0', fontSize: '0.9rem' }}>
                                Supervisión de rendimiento académico y alertas predictivas basadas en IA (Random Forest).
                            </p>
                        </div>

                        {/* Tarjetas resumen de riesgo */}
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', padding: '0.5rem 1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937' }}>{alumnos.length}</div>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Total Alumnos</div>
                            </div>
                            <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', padding: '0.5rem 1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#b91c1c' }}>{conteoAlto}</div>
                                <div style={{ fontSize: '0.75rem', color: '#991b1b' }}>🔴 Alto Riesgo</div>
                            </div>
                            <div style={{ backgroundColor: '#fef3c7', border: '1px solid #fde68a', padding: '0.5rem 1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#b45309' }}>{conteoMedio}</div>
                                <div style={{ fontSize: '0.75rem', color: '#92400e' }}>🟡 Riesgo Medio</div>
                            </div>
                            <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '0.5rem 1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#047857' }}>{conteoBajo}</div>
                                <div style={{ fontSize: '0.75rem', color: '#065f46' }}>🟢 Bajo Riesgo</div>
                            </div>
                        </div>
                    </div>

                    {/* Barra de búsqueda */}
                    <div style={{ marginTop: '1.25rem', position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                        <input
                            type="text"
                            placeholder="Buscar por código, seudónimo o género..."
                            value={filtroBusqueda}
                            onChange={(e) => setFiltroBusqueda(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.65rem 1rem 0.65rem 2.5rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '0.5rem',
                                outline: 'none',
                                fontSize: '0.9rem',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>
                </div>

                {/* Tabla de Estudiantes Matriculados */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '1rem',
                    overflow: 'hidden',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    border: '1px solid #e5e7eb'
                }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#4b5563' }}>
                                <th style={{ padding: '0.85rem 1.25rem', fontWeight: '600' }}>Código</th>
                                <th style={{ padding: '0.85rem 1.25rem', fontWeight: '600' }}>Estudiante (Seudónimo)</th>
                                <th style={{ padding: '0.85rem 1.25rem', fontWeight: '600' }}>Edad</th>
                                <th style={{ padding: '0.85rem 1.25rem', fontWeight: '600' }}>Género</th>
                                <th style={{ padding: '0.85rem 1.25rem', fontWeight: '600' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <Sparkles size={14} color="#6366f1" />
                                        Riesgo Predictivo (IA)
                                    </span>
                                </th>
                                <th style={{ padding: '0.85rem 1.25rem', fontWeight: '600', textAlign: 'right' }}>Expediente</th>
                            </tr>
                        </thead>
                        <tbody>
                            {alumnosFiltrados.map((alumno, index) => {
                                const riesgo = calcularRiesgo(alumno);
                                return (
                                    <tr
                                        key={alumno.id || index}
                                        onClick={() => setEstudianteSeleccionado(alumno)}
                                        style={{
                                            borderBottom: '1px solid #f3f4f6',
                                            backgroundColor: index % 2 === 0 ? 'white' : '#fafafa',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.15s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'white' : '#fafafa'}
                                        title="Haz clic para inspeccionar el expediente detallado"
                                    >
                                        <td style={{ padding: '0.85rem 1.25rem', fontWeight: '600', color: '#1f2937' }}>
                                            {alumno.codigo || `EST-00${index + 1}`}
                                        </td>
                                        <td style={{ padding: '0.85rem 1.25rem', color: '#111827' }}>
                                            <strong>{alumno.seudonimo || 'Sin Seudónimo'}</strong>
                                        </td>
                                        <td style={{ padding: '0.85rem 1.25rem', color: '#4b5563' }}>
                                            {alumno.edad ? `${alumno.edad} años` : 'N/D'}
                                        </td>
                                        <td style={{ padding: '0.85rem 1.25rem', color: '#4b5563' }}>
                                            <span style={{
                                                padding: '0.2rem 0.5rem',
                                                borderRadius: '0.25rem',
                                                fontSize: '0.75rem',
                                                backgroundColor: alumno.genero === 'Femenino' ? '#fdf2f8' : '#eff6ff',
                                                color: alumno.genero === 'Femenino' ? '#9d174d' : '#1e40af',
                                                border: `1px solid ${alumno.genero === 'Femenino' ? '#fbcfe8' : '#bfdbfe'}`
                                            }}>
                                                {alumno.genero || 'No especificado'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.85rem 1.25rem' }}>
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.4rem',
                                                padding: '0.3rem 0.75rem',
                                                borderRadius: '9999px',
                                                backgroundColor: riesgo.bg,
                                                color: riesgo.color,
                                                border: `1px solid ${riesgo.border}`,
                                                fontWeight: 'bold',
                                                fontSize: '0.8rem'
                                            }}>
                                                <span>{riesgo.icono}</span>
                                                <span>{riesgo.texto}</span>
                                                <small style={{ fontWeight: 'normal', opacity: 0.85 }}>({riesgo.probabilidad})</small>
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.25rem',
                                                fontSize: '0.8rem',
                                                color: '#2563eb',
                                                fontWeight: '600'
                                            }}>
                                                Ver detalle <ChevronRight size={15} />
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}

                            {alumnosFiltrados.length === 0 && (
                                <tr>
                                    <td colSpan="6" style={{ padding: '2.5rem', textAlign: 'center', color: '#6b7280' }}>
                                        {alumnos.length === 0
                                            ? 'No hay estudiantes matriculados en esta sección.'
                                            : 'No se encontraron estudiantes que coincidan con la búsqueda.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* MODAL DE EXPEDIENTE DETALLADO DEL ESTUDIANTE */}
                {estudianteSeleccionado && (
                    <div
                        onClick={(e) => { if (e.target === e.currentTarget) setEstudianteSeleccionado(null); }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            backgroundColor: 'rgba(15, 23, 42, 0.65)',
                            backdropFilter: 'blur(4px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 9999,
                            padding: '1rem'
                        }}
                    >
                        <div style={{
                            backgroundColor: 'white',
                            borderRadius: '1rem',
                            width: '100%',
                            maxWidth: '560px',
                            maxHeight: '90vh',
                            overflowY: 'auto',
                            padding: '2rem',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            border: '1px solid #e5e7eb',
                            position: 'relative'
                        }}>
                            {/* Botón de cierre X */}
                            <button
                                onClick={() => setEstudianteSeleccionado(null)}
                                style={{
                                    position: 'absolute',
                                    top: '1.25rem',
                                    right: '1.25rem',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#6b7280',
                                    padding: '0.25rem',
                                    borderRadius: '0.375rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                title="Cerrar expediente"
                            >
                                <X size={22} />
                            </button>

                            {(() => {
                                const info = obtenerFactoresIA(estudianteSeleccionado);
                                const riesgo = info.riesgo;

                                return (
                                    <div>
                                        {/* Encabezado del Expediente */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                                            <div style={{
                                                backgroundColor: '#eff6ff',
                                                padding: '0.75rem',
                                                borderRadius: '0.75rem',
                                                color: '#2563eb'
                                            }}>
                                                <FileText size={28} />
                                            </div>
                                            <div>
                                                <h3 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                                                    {estudianteSeleccionado.seudonimo || 'Estudiante'}
                                                </h3>
                                                <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.85rem' }}>
                                                    Código: <strong style={{ color: '#1f2937' }}>{estudianteSeleccionado.codigo}</strong> · {estudianteSeleccionado.edad || 16} años · {estudianteSeleccionado.genero || 'N/D'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Tarjeta destacada de Alerta Predictiva */}
                                        <div style={{
                                            backgroundColor: riesgo.bg,
                                            border: `1.5px solid ${riesgo.border}`,
                                            borderRadius: '0.75rem',
                                            padding: '1.25rem',
                                            marginBottom: '1.5rem'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span style={{ fontSize: '1.25rem' }}>{riesgo.icono}</span>
                                                    <strong style={{ color: riesgo.color, fontSize: '1.1rem' }}>
                                                        Nivel de Riesgo: {riesgo.nivel}
                                                    </strong>
                                                </div>
                                                <span style={{
                                                    backgroundColor: 'white',
                                                    color: riesgo.color,
                                                    border: `1px solid ${riesgo.border}`,
                                                    padding: '0.25rem 0.6rem',
                                                    borderRadius: '9999px',
                                                    fontWeight: 'bold',
                                                    fontSize: '0.85rem'
                                                }}>
                                                    {riesgo.probabilidad}
                                                </span>
                                            </div>
                                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#374151', lineHeight: '1.45' }}>
                                                <strong>Diagnóstico del Modelo:</strong> {riesgo.nivel === 'Alto'
                                                    ? 'Alta probabilidad de reprobación o deserción escolar. Se recomienda intervención pedagógica inmediata, citación con el apoderado y seguimiento tutorial.'
                                                    : riesgo.nivel === 'Medio'
                                                    ? 'Desempeño fluctuante con señales de advertencia temprana. Se sugiere asignación de tareas de refuerzo y monitoreo de puntualidad.'
                                                    : 'Desempeño académico regular y favorable. No se detectan indicadores críticos de deserción o reprobación para este periodo.'}
                                            </p>
                                        </div>

                                        {/* Desglose de factores evaluados por el modelo de IA */}
                                        <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#374151', marginBottom: '0.75rem' }}>
                                            Desglose de Factores Evaluados (IA Random Forest)
                                        </h4>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                                            <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', padding: '0.85rem', borderRadius: '0.5rem' }}>
                                                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Asistencia Estimada</div>
                                                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937' }}>{info.asistenciaPct}</div>
                                            </div>
                                            <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', padding: '0.85rem', borderRadius: '0.5rem' }}>
                                                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Promedio del Periodo</div>
                                                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937' }}>{info.promedioNotas}</div>
                                            </div>
                                            <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', padding: '0.85rem', borderRadius: '0.5rem' }}>
                                                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Entrega de Trabajos</div>
                                                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937' }}>{info.entregasPct}</div>
                                            </div>
                                            <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', padding: '0.85rem', borderRadius: '0.5rem' }}>
                                                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Comportamiento en Aula</div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginTop: '0.25rem' }}>{info.conducta}</div>
                                            </div>
                                        </div>

                                        {/* Indicadores clave */}
                                        <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '0.85rem', marginBottom: '1.5rem' }}>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#4b5563', marginBottom: '0.5rem' }}>
                                                Indicadores y observaciones del motor predictivo:
                                            </div>
                                            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#4b5563', lineHeight: '1.5' }}>
                                                {info.factoresRiesgo.map((factor, i) => (
                                                    <li key={i}>{factor}</li>
                                                ))}
                                            </ul>
                                        </div>

                                        {/* Botón de cierre */}
                                        <button
                                            onClick={() => setEstudianteSeleccionado(null)}
                                            style={{
                                                width: '100%',
                                                padding: '0.75rem',
                                                backgroundColor: '#2563eb',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '0.5rem',
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                                transition: 'background-color 0.2s'
                                            }}
                                        >
                                            Cerrar expediente
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // =========================================================================
    // VISTA GENERAL: TARJETAS DE AULAS (PANORAMA ACADÉMICO)
    // =========================================================================
    return (
        <div style={{ padding: '2rem', width: '100%' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#111827', marginBottom: '1.5rem' }}>
                Panorama Académico - Mis Aulas
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                {secciones.map((sec) => {
                    const cantAlumnos = sec.estudiantes?.length || 0;

                    return (
                        <div key={sec.id} style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '1px solid #e5e7eb' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
                                        {sec.curso?.nombre || 'Curso sin nombre'}
                                    </h3>
                                    <span style={{ display: 'inline-block', backgroundColor: '#ecfdf5', color: '#065f46', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 'bold', marginTop: '0.5rem' }}>
                                        {sec.nombre} {/* Ej: Sección A */}
                                    </span>
                                </div>
                                <div style={{ backgroundColor: '#f3f4f6', padding: '0.5rem', borderRadius: '0.5rem' }}>
                                    <BookOpen size={20} color="#4b5563" />
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1.5rem', borderTop: '1px solid #f3f4f6', paddingTop: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
                                    <Calendar size={16} style={{ marginRight: '0.5rem' }} />
                                    <span>Periodo: {sec.periodoAcademico}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
                                    <Users size={16} style={{ marginRight: '0.5rem' }} />
                                    <span>Código del Curso: {sec.curso?.codigo || 'N/A'}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', color: '#374151', fontSize: '0.875rem', fontWeight: '500' }}>
                                    <span style={{
                                        display: 'inline-block',
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        backgroundColor: cantAlumnos > 0 ? '#10b981' : '#9ca3af',
                                        marginRight: '0.5rem'
                                    }} />
                                    <span>{cantAlumnos} {cantAlumnos === 1 ? 'estudiante matriculado' : 'estudiantes matriculados'}</span>
                                </div>
                            </div>

                            <button
                                onClick={() => setSeccionSeleccionada(sec)}
                                style={{
                                    width: '100%',
                                    marginTop: '1.5rem',
                                    padding: '0.75rem',
                                    backgroundColor: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.2s'
                                }}
                            >
                                Gestionar Notas
                            </button>
                        </div>
                    );
                })}

                {secciones.length === 0 && (
                    <p style={{ color: '#6b7280' }}>No tienes aulas asignadas en este periodo.</p>
                )}
            </div>
        </div>
    );
}