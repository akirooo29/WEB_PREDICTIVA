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

        // 2. CREACIÓN DE USUARIO ADMINISTRADOR (SUPER USUARIO)
        var emailAdmin = "admin@demo.com";
        var usuarioAdmin = await userManager.FindByEmailAsync(emailAdmin);

        if (usuarioAdmin == null)
        {
            usuarioAdmin = new ApplicationUser
            {
                UserName = emailAdmin,
                Email = emailAdmin,
                EmailConfirmed = true,
                Nombres = "Administrador",
                Apellidos = "Principal del Sistema",
                Dni = "00000000",
                Activo = true,
                FechaRegistro = DateTime.UtcNow
            };

            var createAdminResult = await userManager.CreateAsync(usuarioAdmin, "Password123!");
            if (createAdminResult.Succeeded)
            {
                await userManager.AddToRoleAsync(usuarioAdmin, RolesConst.Administrador);
            }
        }

        // 3. CREACIÓN DE USUARIO PROFESOR DEMO
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

        // 4. CREACIÓN DE USUARIO ESTUDIANTE DEMO
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

        // 5. SEMBRADO MASIVO DE DATOS ACADÉMICOS (Cursos, Secciones y Alumnos)
        if (context != null && !await context.Cursos.AnyAsync())
        {
            // A. Crear Cursos
            var cursoMat = new Curso { Codigo = "MAT-101", Nombre = "Matemáticas Aplicadas", Creditos = 4, Activo = true };
            var cursoCom = new Curso { Codigo = "COM-101", Nombre = "Comunicación Integral", Creditos = 3, Activo = true };
            context.Cursos.AddRange(cursoMat, cursoCom);
            await context.SaveChangesAsync();

            // B. Crear Secciones asignadas al Profesor Demo
            var secMatA = new Seccion { Nombre = "Sección A", PeriodoAcademico = "2026-I", CursoId = cursoMat.Id, ProfesorId = usuarioProfesor?.Id };
            var secMatB = new Seccion { Nombre = "Sección B", PeriodoAcademico = "2026-I", CursoId = cursoMat.Id, ProfesorId = usuarioProfesor?.Id };
            var secComA = new Seccion { Nombre = "Sección A", PeriodoAcademico = "2026-I", CursoId = cursoCom.Id, ProfesorId = usuarioProfesor?.Id };
            context.Secciones.AddRange(secMatA, secMatB, secComA);
            await context.SaveChangesAsync();

            // C. Crear 60 Estudiantes masivos
            var random = new Random();
            var apellidos = new[] { "García", "Rodríguez", "López", "Pérez", "González", "Sánchez", "Ramírez", "Torres", "Flores", "Díaz" };
            var nombres = new[] { "Mateo", "Valentina", "Sebastián", "Camila", "Matías", "Valeria", "Diego", "Mariana", "Joaquín", "Luciana" };
            var listaAlumnos = new List<Estudiante>();

            for (int i = 1; i <= 60; i++)
            {
                var nuevoEstudiante = new Estudiante
                {
                    Codigo = $"EST-26-00{i + 1}",
                    Seudonimo = $"{nombres[random.Next(nombres.Length)]} {apellidos[random.Next(apellidos.Length)][0]}.",
                    Edad = random.Next(14, 18),
                    Genero = random.Next(2) == 0 ? "Masculino" : "Femenino",
                    Activo = true,
                    FechaCreacion = DateTime.UtcNow
                };
                listaAlumnos.Add(nuevoEstudiante);
            }
            context.Estudiantes.AddRange(listaAlumnos);
            await context.SaveChangesAsync();

            // D. Matricular aleatoriamente a los alumnos en las secciones
            foreach (var alumno in listaAlumnos)
            {
                if (random.Next(2) == 0) secMatA.Estudiantes.Add(alumno);
                else secMatB.Estudiantes.Add(alumno);

                if (random.Next(100) < 70) secComA.Estudiantes.Add(alumno);
            }
            await context.SaveChangesAsync();
        }
    }
}