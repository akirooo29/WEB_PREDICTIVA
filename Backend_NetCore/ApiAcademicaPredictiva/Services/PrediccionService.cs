using System.Net.Http.Json;
using System.Text.Json;
using ApiAcademicaPredictiva.DTOs.Prediccion;

namespace ApiAcademicaPredictiva.Services;

/// <summary>
/// Implementación del servicio de integración con el microservicio de IA en Python.
/// Utiliza HttpClient inyectado y gestionado por IHttpClientFactory para optimizar
/// el manejo de sockets y conexiones HTTP.
/// </summary>
public class PrediccionService : IPrediccionService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<PrediccionService> _logger;

    public PrediccionService(HttpClient httpClient, ILogger<PrediccionService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<PrediccionRiesgoDto?> PredecirRiesgoAsync(AlumnoMetricasDto metricas, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Enviando métricas del alumno {EstudianteId} al microservicio de IA en Python...", metricas.EstudianteId);

            // POST enviando las métricas en formato JSON al endpoint /predecir
            var endpoint = _httpClient.BaseAddress != null ? "predecir" : "http://localhost:5000/predecir";
            var response = await _httpClient.PostAsJsonAsync(endpoint, metricas, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogError("El microservicio de IA retornó error {StatusCode}: {ErrorBody}", response.StatusCode, errorBody);
                throw new HttpRequestException($"Fallo al invocar el microservicio de IA. Status: {response.StatusCode}, Detalle: {errorBody}");
            }

            var resultado = await response.Content.ReadFromJsonAsync<PrediccionRiesgoDto>(
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true },
                cancellationToken
            );

            _logger.LogInformation("Predicción procesada correctamente para el alumno {EstudianteId}. Nivel: {Nivel}, Riesgo: {Puntaje}%",
                metricas.EstudianteId, resultado?.Nivel, resultado?.Puntaje);

            return resultado;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Error de comunicación HTTP con la API en Python (http://localhost:5000/predecir). Verifique que el servicio esté en ejecución.");
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ocurrió un error inesperado al procesar la predicción del alumno {EstudianteId}.", metricas.EstudianteId);
            throw;
        }
    }
}
