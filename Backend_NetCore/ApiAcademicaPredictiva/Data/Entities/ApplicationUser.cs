using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.AspNetCore.Identity;

namespace ApiAcademicaPredictiva.Data.Entities;

/// <summary>
/// Usuario extendido de ASP.NET Core Identity.
/// </summary>
public class ApplicationUser : IdentityUser
{
    [Required]
    [MaxLength(100)]
    public string Nombres { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Apellidos { get; set; } = string.Empty;

    [NotMapped]
    public string NombreCompleto => $"{Nombres} {Apellidos}".Trim();

    [MaxLength(20)]
    public string? Dni { get; set; }

    public bool Activo { get; set; } = true;

    public DateTime FechaRegistro { get; set; } = DateTime.UtcNow;

    // Relación opcional 1-a-1 si el usuario es un Estudiante con acceso al sistema
    public Estudiante? PerfilEstudiante { get; set; }
}
