using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ApiAcademicaPredictiva.Data.Entities;

/// <summary>
/// Reporte disciplinario o conductual de un alumno.
/// Alimenta directamente la variable 'reportes_conducta' del motor predictivo.
/// </summary>
[Table("ReportesConducta")]
public class ReporteConducta
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    [Required]
    public int EstudianteId { get; set; }
    public Estudiante Estudiante { get; set; } = null!;

    // Docente o autoridad que emite el reporte
    public string? DocenteId { get; set; }
    public ApplicationUser? Docente { get; set; }

    [Required]
    public DateTime Fecha { get; set; } = DateTime.UtcNow;

    [Required]
    [MaxLength(500)]
    public string Descripcion { get; set; } = string.Empty;

    /// <summary>
    /// Clasificación de la falta: "Leve", "Moderada", "Grave"
    /// </summary>
    [Required]
    [MaxLength(20)]
    public string Gravedad { get; set; } = "Leve";

    [MaxLength(250)]
    public string? AccionTomada { get; set; }
}
