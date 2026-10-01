using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ApiAcademicaPredictiva.Data.Entities;

/// <summary>
/// Registra las inferencias generadas por el microservicio de IA (Random Forest).
/// Permite mantener una trazabilidad histórica del riesgo de deserción/fracaso escolar.
/// </summary>
[Table("HistorialRiesgos")]
public class HistorialRiesgo
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    [Required]
    public int EstudianteId { get; set; }
    public Estudiante Estudiante { get; set; } = null!;

    public int? CursoId { get; set; }
    public Curso? Curso { get; set; }

    /// <summary>
    /// Clasificación generada por el modelo: "Bajo", "Medio", "Alto"
    /// </summary>
    [Required]
    [MaxLength(20)]
    public string NivelRiesgo { get; set; } = string.Empty;

    /// <summary>
    /// Probabilidad calculada o porcentaje de riesgo (0.00% a 100.00%)
    /// </summary>
    [Required]
    [Column(TypeName = "decimal(5,2)")]
    public decimal Puntaje { get; set; }

    /// <summary>
    /// Sugerencia o protocolo pedagógico automatizado sugerido por el sistema
    /// </summary>
    [Required]
    [MaxLength(1000)]
    public string Recomendacion { get; set; } = string.Empty;

    public DateTime FechaEvaluacion { get; set; } = DateTime.UtcNow;

    // Snapshot histórico de las variables enviadas al modelo al momento del cálculo
    [Column(TypeName = "decimal(5,2)")]
    public decimal? AsistenciaPct { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal? PromedioNotas { get; set; }

    public int? TareasEntregadas { get; set; }

    public int? ReportesConducta { get; set; }
}
