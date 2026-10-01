using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ApiAcademicaPredictiva.Data.Entities;

/// <summary>
/// Instancia activa de un Curso en un periodo académico específico (Aula o Grupo).
/// </summary>
[Table("Secciones")]
public class Seccion
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string Nombre { get; set; } = string.Empty; // Ej. "Sección A", "Aula 101"

    [Required]
    [MaxLength(20)]
    public string PeriodoAcademico { get; set; } = string.Empty; // Ej. "2026-I"

    // Relación con Curso
    [Required]
    public int CursoId { get; set; }
    public Curso Curso { get; set; } = null!;

    // Relación con el Docente asignado (Usuario con rol 'Profesor')
    public string? ProfesorId { get; set; }
    public ApplicationUser? Profesor { get; set; }

    // Alumnos matriculados en esta sección
    public ICollection<Estudiante> Estudiantes { get; set; } = new List<Estudiante>();

    // Registros asociados
    public ICollection<Asistencia> Asistencias { get; set; } = new List<Asistencia>();
    public ICollection<Evaluacion> Evaluaciones { get; set; } = new List<Evaluacion>();
}
