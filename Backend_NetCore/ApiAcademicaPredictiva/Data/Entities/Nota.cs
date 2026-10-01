using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ApiAcademicaPredictiva.Data.Entities;

/// <summary>
/// Calificación obtenida por un estudiante en una evaluación.
/// Alimenta directamente 'promedio_notas' y 'tareas_entregadas' para el motor de IA.
/// </summary>
[Table("Notas")]
public class Nota
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    [Required]
    public int EvaluacionId { get; set; }
    public Evaluacion Evaluacion { get; set; } = null!;

    [Required]
    public int EstudianteId { get; set; }
    public Estudiante Estudiante { get; set; } = null!;

    /// <summary>
    /// Calificación numérica obtenida (ej. 0.00 a 20.00 o 0.00 a 100.00).
    /// </summary>
    [Required]
    [Column(TypeName = "decimal(5,2)")]
    public decimal Puntaje { get; set; }

    /// <summary>
    /// Indica si el estudiante completó y entregó la actividad/tarea a tiempo.
    /// Clave para calcular el conteo de 'tareas_entregadas' en IA.
    /// </summary>
    public bool EsTareaEntregada { get; set; } = true;

    public DateTime FechaRegistro { get; set; } = DateTime.UtcNow;

    [MaxLength(250)]
    public string? Comentarios { get; set; }
}
