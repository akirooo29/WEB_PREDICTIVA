using System.ComponentModel.DataAnnotations;

namespace ApiAcademicaPredictiva.DTOs.Auth;

public class LoginDto
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;
}

public class RegistroDto
{
    [Required]
    [MaxLength(100)]
    public string Nombres { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Apellidos { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MinLength(6)]
    public string Password { get; set; } = string.Empty;

    public string? Dni { get; set; }

    /// <summary>
    /// Rol a asignar (ej. "Profesor", "Estudiante", "Director", "Apoderado")
    /// </summary>
    public string Rol { get; set; } = "Profesor";
}

public class AuthResponseDto
{
    public bool Exitoso { get; set; }
    public string Mensaje { get; set; } = string.Empty;
    public string? Token { get; set; }
    public DateTime? Expiracion { get; set; }
    public string? UsuarioId { get; set; }
    public string? Email { get; set; }
    public string? NombreCompleto { get; set; }
    public IList<string>? Roles { get; set; }
}
