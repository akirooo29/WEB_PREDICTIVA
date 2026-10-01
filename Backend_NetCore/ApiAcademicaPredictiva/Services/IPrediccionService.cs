using ApiAcademicaPredictiva.DTOs.Prediccion;

namespace ApiAcademicaPredictiva.Services;

/// <summary>
/// Contrato del servicio para la comunicación con el microservicio predictivo en Python.
/// </summary>
public interface IPrediccionService
{
    /// <summary>
    /// Envía las métricas académicas y disciplinarias del estudiante a la API en Python
    /// y retorna el nivel de riesgo predicho junto con las recomendaciones pedagógicas.
    /// </summary>
    /// <param name="metricas">Objeto con los indicadores del alumno (asistencia, promedio, tareas, conducta).</param>
    /// <param name="cancellationToken">Token de cancelación opcional.</param>
    /// <returns>Resultado deserializado con el nivel de riesgo y recomendaciones.</returns>
    Task<PrediccionRiesgoDto?> PredecirRiesgoAsync(AlumnoMetricasDto metricas, CancellationToken cancellationToken = default);
}
