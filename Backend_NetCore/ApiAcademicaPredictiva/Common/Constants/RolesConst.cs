namespace ApiAcademicaPredictiva.Common.Constants;

/// <summary>
/// Nombres de los roles del sistema de gestión académica.
/// </summary>
public static class RolesConst
{
    public const string Administrador = "Administrador";
    public const string Director = "Director";
    public const string Profesor = "Profesor";
    public const string Estudiante = "Estudiante";
    public const string Apoderado = "Apoderado";

    public static readonly IReadOnlyList<string> Todos = new[]
    {
        Administrador,
        Director,
        Profesor,
        Estudiante,
        Apoderado
    };
}
