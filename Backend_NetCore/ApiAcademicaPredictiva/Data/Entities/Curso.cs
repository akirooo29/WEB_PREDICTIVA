using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ApiAcademicaPredictiva.Data.Entities;

/// <summary>
/// Catálogo general de asignaturas/cursos.
/// </summary>
[Table("Cursos")]
public class Curso
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    [Required]
    [MaxLength(20)]
    public string Codigo { get; set; } = string.Empty; // Ej. "MAT-101"

    [Required]
    [MaxLength(150)]
    public string Nombre { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Descripcion { get; set; }

    public int Creditos { get; set; } = 3;

    public bool Activo { get; set; } = true;

    // Relaciones
    public ICollection<Seccion> Secciones { get; set; } = new List<Seccion>();
    public ICollection<HistorialRiesgo> HistorialRiesgos { get; set; } = new List<HistorialRiesgo>();
}
