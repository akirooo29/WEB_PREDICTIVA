using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ApiAcademicaPredictiva.Data.Entities;

/// <summary>
/// Representa a un estudiante en el sistema y los datos demográficos para el modelo de IA.
/// </summary>
[Table("Estudiantes")]
public class Estudiante
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    [Required]
    [MaxLength(20)]
    public string Codigo { get; set; } = string.Empty;

    /// <summary>
    /// Seudónimo o alias para proteger la privacidad del alumno (Ley de Protección de Datos Personales / Ética en IA).
    /// </summary>
    [Required]
    [MaxLength(100)]
    public string Seudonimo { get; set; } = string.Empty;

    [Required]
    [Range(3, 100)]
    public int Edad { get; set; }

    [MaxLength(20)]
    public string? Genero { get; set; }

    public bool Activo { get; set; } = true;

    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;

    // Vinculación opcional con la cuenta de Identity (si el alumno tiene credenciales de acceso)
    public string? UserId { get; set; }
    public ApplicationUser? User { get; set; }

    // Propiedades de navegación
    public ICollection<Seccion> Secciones { get; set; } = new List<Seccion>();
    public ICollection<Asistencia> Asistencias { get; set; } = new List<Asistencia>();
    public ICollection<Nota> Notas { get; set; } = new List<Nota>();
    public ICollection<ReporteConducta> ReportesConducta { get; set; } = new List<ReporteConducta>();
    public ICollection<HistorialRiesgo> HistorialRiesgos { get; set; } = new List<HistorialRiesgo>();
}
