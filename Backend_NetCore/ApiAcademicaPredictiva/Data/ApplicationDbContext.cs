using ApiAcademicaPredictiva.Common.Constants;
using ApiAcademicaPredictiva.Data.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace ApiAcademicaPredictiva.Data;

/// <summary>
/// Contexto principal de Entity Framework Core para la base de datos SQL Server,
/// integrando ASP.NET Core Identity y las entidades del dominio académico.
/// </summary>
public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<Estudiante> Estudiantes => Set<Estudiante>();
    public DbSet<Curso> Cursos => Set<Curso>();
    public DbSet<Seccion> Secciones => Set<Seccion>();
    public DbSet<Asistencia> Asistencias => Set<Asistencia>();
    public DbSet<Evaluacion> Evaluaciones => Set<Evaluacion>();
    public DbSet<Nota> Notas => Set<Nota>();
    public DbSet<ReporteConducta> ReportesConducta => Set<ReporteConducta>();
    public DbSet<HistorialRiesgo> HistorialRiesgos => Set<HistorialRiesgo>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        // 1. OBLIGATORIO: Invocar base para que ASP.NET Identity configure sus tablas
        base.OnModelCreating(builder);

        // 2. Sembrado inicial de los Roles del Sistema (Guids estáticos para idempotencia)
        var roleAdminId = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
        var roleDirectorId = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
        var roleProfesorId = "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f";
        var roleEstudianteId = "d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a";
        var roleApoderadoId = "e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b";

        builder.Entity<IdentityRole>().HasData(
            new IdentityRole { Id = roleAdminId, Name = RolesConst.Administrador, NormalizedName = RolesConst.Administrador.ToUpper(), ConcurrencyStamp = roleAdminId },
            new IdentityRole { Id = roleDirectorId, Name = RolesConst.Director, NormalizedName = RolesConst.Director.ToUpper(), ConcurrencyStamp = roleDirectorId },
            new IdentityRole { Id = roleProfesorId, Name = RolesConst.Profesor, NormalizedName = RolesConst.Profesor.ToUpper(), ConcurrencyStamp = roleProfesorId },
            new IdentityRole { Id = roleEstudianteId, Name = RolesConst.Estudiante, NormalizedName = RolesConst.Estudiante.ToUpper(), ConcurrencyStamp = roleEstudianteId },
            new IdentityRole { Id = roleApoderadoId, Name = RolesConst.Apoderado, NormalizedName = RolesConst.Apoderado.ToUpper(), ConcurrencyStamp = roleApoderadoId }
        );

        // 3. Configuración Fluent API - Estudiante
        builder.Entity<Estudiante>(entity =>
        {
            entity.HasIndex(e => e.Codigo).IsUnique();

            // Relación opcional 1-a-1 con ApplicationUser
            entity.HasOne(e => e.User)
                  .WithOne(u => u.PerfilEstudiante)
                  .HasForeignKey<Estudiante>(e => e.UserId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // 4. Configuración Fluent API - Curso
        builder.Entity<Curso>(entity =>
        {
            entity.HasIndex(c => c.Codigo).IsUnique();
        });

        // 5. Configuración Fluent API - Seccion
        builder.Entity<Seccion>(entity =>
        {
            entity.HasOne(s => s.Curso)
                  .WithMany(c => c.Secciones)
                  .HasForeignKey(s => s.CursoId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(s => s.Profesor)
                  .WithMany()
                  .HasForeignKey(s => s.ProfesorId)
                  .OnDelete(DeleteBehavior.SetNull);

            // Relación Muchos a Muchos: Seccion <-> Estudiante
            entity.HasMany(s => s.Estudiantes)
                  .WithMany(e => e.Secciones)
                  .UsingEntity<Dictionary<string, object>>(
                      "EstudiantesSecciones",
                      j => j.HasOne<Estudiante>().WithMany().HasForeignKey("EstudianteId").OnDelete(DeleteBehavior.Cascade),
                      j => j.HasOne<Seccion>().WithMany().HasForeignKey("SeccionId").OnDelete(DeleteBehavior.Cascade)
                  );
        });

        // 6. Configuración Fluent API - Asistencia
        // NOTA DE ARQUITECTURA: Se usa DeleteBehavior.Restrict en Seccion para evitar ciclos en SQL Server
        builder.Entity<Asistencia>(entity =>
        {
            entity.HasOne(a => a.Estudiante)
                  .WithMany(e => e.Asistencias)
                  .HasForeignKey(a => a.EstudianteId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(a => a.Seccion)
                  .WithMany(s => s.Asistencias)
                  .HasForeignKey(a => a.SeccionId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(a => new { a.EstudianteId, a.SeccionId, a.Fecha });
        });

        // 7. Configuración Fluent API - Evaluacion
        builder.Entity<Evaluacion>(entity =>
        {
            entity.Property(e => e.Peso)
                  .HasPrecision(5, 2);

            entity.HasOne(ev => ev.Seccion)
                  .WithMany(s => s.Evaluaciones)
                  .HasForeignKey(ev => ev.SeccionId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // 8. Configuración Fluent API - Nota
        // NOTA DE ARQUITECTURA: DeleteBehavior.Restrict en Estudiante para evitar error de rutas múltiples de cascada en SQL Server
        builder.Entity<Nota>(entity =>
        {
            entity.Property(n => n.Puntaje)
                  .HasPrecision(5, 2);

            entity.HasOne(n => n.Evaluacion)
                  .WithMany(ev => ev.Notas)
                  .HasForeignKey(n => n.EvaluacionId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(n => n.Estudiante)
                  .WithMany(e => e.Notas)
                  .HasForeignKey(n => n.EstudianteId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(n => new { n.EvaluacionId, n.EstudianteId }).IsUnique();
        });

        // 9. Configuración Fluent API - ReporteConducta
        builder.Entity<ReporteConducta>(entity =>
        {
            entity.HasOne(r => r.Estudiante)
                  .WithMany(e => e.ReportesConducta)
                  .HasForeignKey(r => r.EstudianteId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(r => r.Docente)
                  .WithMany()
                  .HasForeignKey(r => r.DocenteId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // 10. Configuración Fluent API - HistorialRiesgo
        builder.Entity<HistorialRiesgo>(entity =>
        {
            entity.Property(h => h.Puntaje).HasPrecision(5, 2);
            entity.Property(h => h.AsistenciaPct).HasPrecision(5, 2);
            entity.Property(h => h.PromedioNotas).HasPrecision(5, 2);

            entity.HasOne(h => h.Estudiante)
                  .WithMany(e => e.HistorialRiesgos)
                  .HasForeignKey(h => h.EstudianteId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(h => h.Curso)
                  .WithMany(c => c.HistorialRiesgos)
                  .HasForeignKey(h => h.CursoId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(h => new { h.EstudianteId, h.FechaEvaluacion });
        });
    }
}
