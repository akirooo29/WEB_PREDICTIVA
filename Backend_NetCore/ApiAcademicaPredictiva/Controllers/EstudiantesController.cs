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
    [Authorize] // 1. CANDADO GLOBAL: Solo usuarios con Token JWT
    public class EstudiantesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public EstudiantesController(ApplicationDbContext context)
        {
            _context = context;
        }

        // ========================================================================
        // CONSULTAS (GET) - Accesible para Admin, Director, Profesor, etc.
        // ========================================================================

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Estudiante>>> GetEstudiantes()
        {
            return await _context.Estudiantes.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Estudiante>> GetEstudiante(int id)
        {
            var estudiante = await _context.Estudiantes.FindAsync(id);
            if (estudiante == null) return NotFound();
            return estudiante;
        }

        // ========================================================================
        // MANTENIMIENTO (PUT, POST, DELETE) - Exclusivo para el Administrador
        // ========================================================================

        [Authorize(Roles = RolesConst.Administrador)] // 2. CANDADO ESPECÍFICO
        [HttpPut("{id}")]
        public async Task<IActionResult> PutEstudiante(int id, Estudiante estudiante)
        {
            if (id != estudiante.Id) return BadRequest();

            _context.Entry(estudiante).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!EstudianteExists(id)) return NotFound();
                else throw;
            }

            return NoContent();
        }

        [Authorize(Roles = RolesConst.Administrador)]
        [HttpPost]
        public async Task<ActionResult<Estudiante>> PostEstudiante(Estudiante estudiante)
        {
            _context.Estudiantes.Add(estudiante);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetEstudiante", new { id = estudiante.Id }, estudiante);
        }

        [Authorize(Roles = RolesConst.Administrador)]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteEstudiante(int id)
        {
            var estudiante = await _context.Estudiantes.FindAsync(id);
            if (estudiante == null) return NotFound();

            _context.Estudiantes.Remove(estudiante);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool EstudianteExists(int id)
        {
            return _context.Estudiantes.Any(e => e.Id == id);
        }
    }
}