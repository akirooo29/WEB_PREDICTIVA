using ApiAcademicaPredictiva.Data;
using ApiAcademicaPredictiva.Data.Entities;
using ApiAcademicaPredictiva.DTOs.Prediccion;
using ApiAcademicaPredictiva.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ApiAcademicaPredictiva.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PrediccionController : ControllerBase
{
    private readonly IPrediccionService _prediccionService;
    private readonly ApplicationDbContext _context;
    private readonly ILogger<PrediccionController> _logger;

    public PrediccionController(
        IPrediccionService prediccionService,
        ApplicationDbContext context,
        ILogger<PrediccionController> logger)
    {
        _prediccionService = prediccionService;
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Envía métricas académicas directamente al microservicio de Python y guarda el resultado en el historial.
    /// </summary>
    [HttpPost("evaluar")]
    public async Task<ActionResult<PrediccionRiesgoDto>> EvaluarRiesgo([FromBody] AlumnoMetricasDto metricas)
    {
        if (metricas == null)
            return BadRequest("Las métricas del alumno son requeridas.");

        try
        {
            var resultado = await _prediccionService.PredecirRiesgoAsync(metricas);

            if (resultado == null)
                return StatusCode(502, "No se recibió respuesta válida del microservicio de IA.");

            // Si el estudiante existe en la base de datos, persistimos la evaluación en HistorialRiesgos
            var estudianteExiste = await _context.Estudiantes.AnyAsync(e => e.Id == metricas.EstudianteId);
            if (estudianteExiste)
            {
                var historial = new HistorialRiesgo
                {
                    EstudianteId = metricas.EstudianteId,
                    NivelRiesgo = resultado.Nivel,
                    Puntaje = resultado.Puntaje,
                    Recomendacion = resultado.Recomendaciones,
                    FechaEvaluacion = DateTime.UtcNow,
                    AsistenciaPct = metricas.AsistenciaPct,
                    PromedioNotas = metricas.PromedioNotas,
                    TareasEntregadas = metricas.TareasEntregadas,
                    ReportesConducta = metricas.ReportesConducta
                };

                _context.HistorialRiesgos.Add(historial);
                await _context.SaveChangesAsync();
            }

            return Ok(resultado);
        }
        catch (HttpRequestException ex)
        {
            return StatusCode(503, new { mensaje = "Microservicio de IA en Python no disponible.", detalle = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al evaluar predicción.");
            return StatusCode(500, new { mensaje = "Error interno al procesar predicción.", detalle = ex.Message });
        }
    }

    /// <summary>
    /// Calcula automáticamente las métricas de un estudiante almacenadas en la base de datos
    /// y consulta la predicción a la IA.
    /// </summary>
    [HttpPost("evaluar-estudiante/{estudianteId:int}")]
    public async Task<ActionResult<PrediccionRiesgoDto>> EvaluarEstudiantePorId(int estudianteId)
    {
        var estudiante = await _context.Estudiantes
            .Include(e => e.Asistencias)
            .Include(e => e.Notas)
            .Include(e => e.ReportesConducta)
            .FirstOrDefaultAsync(e => e.Id == estudianteId);

        if (estudiante == null)
            return NotFound($"No se encontró al estudiante con ID {estudianteId}.");

        // Cálculo de métricas
        var totalAsistencias = estudiante.Asistencias.Count;
        var asistenciasPresente = estudiante.Asistencias.Count(a => a.Estado == "Presente");
        var asistenciaPct = totalAsistencias > 0
            ? Math.Round(((decimal)asistenciasPresente / totalAsistencias) * 100m, 2)
            : 100.0m;

        var promedioNotas = estudiante.Notas.Any()
            ? Math.Round(estudiante.Notas.Average(n => n.Puntaje), 2)
            : 11.0m;

        var tareasEntregadas = estudiante.Notas.Count(n => n.EsTareaEntregada);
        var reportesConducta = estudiante.ReportesConducta.Count;

        var metricas = new AlumnoMetricasDto
        {
            EstudianteId = estudiante.Id,
            AsistenciaPct = asistenciaPct,
            PromedioNotas = promedioNotas,
            TareasEntregadas = tareasEntregadas,
            ReportesConducta = reportesConducta
        };

        return await EvaluarRiesgo(metricas);
    }
}
