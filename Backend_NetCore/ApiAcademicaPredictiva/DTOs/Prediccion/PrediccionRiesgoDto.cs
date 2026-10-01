using System.Text.Json.Serialization;

namespace ApiAcademicaPredictiva.DTOs.Prediccion;

/// <summary>
/// DTO con la respuesta devuelta por el microservicio en Python con la evaluación del riesgo.
/// </summary>
public class PrediccionRiesgoDto
{
    [JsonPropertyName("estudiante_id")]
    public object? EstudianteId { get; set; }

    [JsonPropertyName("curso_id")]
    public string? CursoId { get; set; }

    [JsonPropertyName("puntaje")]
    public decimal Puntaje { get; set; }

    [JsonPropertyName("nivel")]
    public string Nivel { get; set; } = string.Empty;

    [JsonPropertyName("recomendaciones")]
    public string Recomendaciones { get; set; } = string.Empty;
}
