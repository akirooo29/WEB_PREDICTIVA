using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ApiAcademicaPredictiva.Data.Entities;

/// <summary>
/// Registro de asistencia de un estudiante por sesión de clase.
/// Alimenta directamente la métrica predictiva de 'asistencia_pct'.
/// </summary>
[Table("Asistencias")]
public class Asistencia
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    [Required]
    public int EstudianteId { get; set; }
    public Estudiante Estudiante { get; set; } = null!;

    [Required]
    public int SeccionId { get; set; }
    public Seccion Seccion { get; set; } = null!;

    [Required]
    public DateTime Fecha { get; set; }

    /// <summary>
    /// Valores esperados: "Presente", "Ausente", "Tardanza", "Justificado"
    /// </summary>
    [Required]
    [MaxLength(20)]
    public string Estado { get; set; } = "Presente";

    [MaxLength(250)]
    public string? Observacion { get; set; }
}
