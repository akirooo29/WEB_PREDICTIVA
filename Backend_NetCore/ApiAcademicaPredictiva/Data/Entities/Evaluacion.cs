using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ApiAcademicaPredictiva.Data.Entities;

/// <summary>
/// Definición de una evaluación académica planificada dentro de una sección (ej. Tarea, Práctica, Examen).
/// </summary>
[Table("Evaluaciones")]
public class Evaluacion
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Nombre { get; set; } = string.Empty; // Ej. "Tarea 1 - Vectores", "Examen Parcial"

    /// <summary>
    /// Tipo de evaluación: "Tarea", "Examen", "Practica", "Proyecto"
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string Tipo { get; set; } = "Tarea";

    [Column(TypeName = "decimal(5,2)")]
    public decimal Peso { get; set; } = 1.0m;

    public DateTime FechaProgramada { get; set; }

    // Relación con Sección
    [Required]
    public int SeccionId { get; set; }
    public Seccion Seccion { get; set; } = null!;

    // Notas de los estudiantes
    public ICollection<Nota> Notas { get; set; } = new List<Nota>();
}
