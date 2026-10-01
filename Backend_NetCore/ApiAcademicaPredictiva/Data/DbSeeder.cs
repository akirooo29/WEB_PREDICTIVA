using ApiAcademicaPredictiva.Common.Constants;
using ApiAcademicaPredictiva.Data.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace ApiAcademicaPredictiva.Data;

/// <summary>
/// Clase responsable de inicializar y sembrar datos de prueba iniciales (Roles y Usuarios demo)
/// de forma idempotente cada vez que arranca la aplicación en desarrollo.
/// </summary>
public static class DbSeeder
{
    public static async Task SeedAsync(
        RoleManager<IdentityRole> roleManager,
        UserManager<ApplicationUser> userManager,
        ApplicationDbContext? context = null)
    {
        // 1. CREACIÓN DE ROLES DEL SISTEMA
        string[] roles = 
        {
            RolesConst.Administrador,
            RolesConst.Director,
            RolesConst.Profesor,
            RolesConst.Estudiante,
            RolesConst.Apoderado
        };

        foreach (var rol in roles)
        {
            if (!await roleManager.RoleExistsAsync(rol))
            {
                await roleManager.CreateAsync(new IdentityRole(rol));
            }
        }

        // 2. CREACIÓN DE USUARIO PROFESOR DEMO
        var emailProfesor = "profesor1@demo.com";
        var usuarioProfesor = await userManager.FindByEmailAsync(emailProfesor);

        if (usuarioProfesor == null)
        {
            usuarioProfesor = new ApplicationUser
            {
                UserName = emailProfesor,
                Email = emailProfesor,
                EmailConfirmed = true,
                Nombres = "Carlos Alberto",
                Apellidos = "Mendoza Ruiz",
                Dni = "45871236",
                Activo = true,
                FechaRegistro = DateTime.UtcNow
            };

            var createProfesorResult = await userManager.CreateAsync(usuarioProfesor, "Password123!");
            if (createProfesorResult.Succeeded)
            {
                await userManager.AddToRoleAsync(usuarioProfesor, RolesConst.Profesor);
            }
        }

        // 3. CREACIÓN DE USUARIO ESTUDIANTE DEMO
        var emailEstudiante = "estudiante1@demo.com";
        var usuarioEstudiante = await userManager.FindByEmailAsync(emailEstudiante);

        if (usuarioEstudiante == null)
        {
            usuarioEstudiante = new ApplicationUser
            {
                UserName = emailEstudiante,
                Email = emailEstudiante,
                EmailConfirmed = true,
                Nombres = "Juan Diego",
                Apellidos = "Pérez Quispe",
                Dni = "78451296",
                Activo = true,
                FechaRegistro = DateTime.UtcNow
            };

            var createEstudianteResult = await userManager.CreateAsync(usuarioEstudiante, "Password123!");
            if (createEstudianteResult.Succeeded)
            {
                await userManager.AddToRoleAsync(usuarioEstudiante, RolesConst.Estudiante);

                // Si se dispone del DbContext, creamos también su perfil en la tabla de dominio 'Estudiantes'
                if (context != null)
                {
                    var perfilExiste = await context.Estudiantes.AnyAsync(e => e.UserId == usuarioEstudiante.Id);
                    if (!perfilExiste)
                    {
                        context.Estudiantes.Add(new Estudiante
                        {
                            Codigo = "EST-2026-001",
                            Seudonimo = "Alumno 99", // Seudónimo utilizado en las pruebas del modelo Random Forest
                            Edad = 16,
                            Genero = "Masculino",
                            Activo = true,
                            FechaCreacion = DateTime.UtcNow,
                            UserId = usuarioEstudiante.Id
                        });
                        await context.SaveChangesAsync();
                    }
                }
            }
        }
    }
}
