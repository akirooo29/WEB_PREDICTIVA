using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ApiAcademicaPredictiva.Data;
using ApiAcademicaPredictiva.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using ApiAcademicaPredictiva.Common.Constants;

namespace ApiAcademicaPredictiva.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize] // 1. CANDADO GLOBAL: Nadie entra sin Token JWT
    public class SeccionesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public SeccionesController(ApplicationDbContext context)
        {
            _context = context;
        }

        // ========================================================================
        // CONSULTAS (GET) - Accesible para cualquier usuario logueado
        // ========================================================================

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Seccion>>> GetSecciones()
        {
            // El .Include() hace un JOIN automático para traer los datos del Curso y Estudiantes
            return await _context.Secciones
                                 .Include(s => s.Curso)
                                 .Include(s => s.Estudiantes)
                                 .ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Seccion>> GetSeccion(int id)
        {
            var seccion = await _context.Secciones
                                        .Include(s => s.Curso)
                                        .Include(s => s.Estudiantes)
                                        .FirstOrDefaultAsync(s => s.Id == id);

            if (seccion == null) return NotFound();
            return seccion;
        }

        // ========================================================================
        // MANTENIMIENTO (PUT, POST, DELETE) - Exclusivo para el Administrador
        // ========================================================================

        [Authorize(Roles = RolesConst.Administrador)] // 2. CANDADO ESPECÍFICO
        [HttpPut("{id}")]
        public async Task<IActionResult> PutSeccion(int id, Seccion seccion)
        {
            if (id != seccion.Id) return BadRequest();

            _context.Entry(seccion).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!SeccionExists(id)) return NotFound();
                else throw;
            }

            return NoContent();
        }

        [Authorize(Roles = RolesConst.Administrador)]
        [HttpPost]
        public async Task<ActionResult<Seccion>> PostSeccion(Seccion seccion)
        {
            _context.Secciones.Add(seccion);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetSeccion", new { id = seccion.Id }, seccion);
        }

        [Authorize(Roles = RolesConst.Administrador)]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSeccion(int id)
        {
            var seccion = await _context.Secciones.FindAsync(id);
            if (seccion == null) return NotFound();

            _context.Secciones.Remove(seccion);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool SeccionExists(int id)
        {
            return _context.Secciones.Any(e => e.Id == id);
        }
    }
}