using System.Text.Json.Serialization;

namespace ApiAcademicaPredictiva.DTOs.Prediccion;

/// <summary>
/// DTO con las métricas del alumno para enviar al microservicio de Python (Random Forest).
/// Los nombres de propiedades coinciden con los esperados por el script modelo_rf.py / API FastAPI/Flask.
/// </summary>
public class AlumnoMetricasDto
{
    [JsonPropertyName("estudiante_id")]
    public int EstudianteId { get; set; }

    [JsonPropertyName("curso_id")]
    public string? CursoId { get; set; }

    [JsonPropertyName("asistencia_pct")]
    public decimal AsistenciaPct { get; set; }

    [JsonPropertyName("promedio_notas")]
    public decimal PromedioNotas { get; set; }

    [JsonPropertyName("tareas_entregadas")]
    public int TareasEntregadas { get; set; }

    [JsonPropertyName("reportes_conducta")]
    public int ReportesConducta { get; set; }
}
