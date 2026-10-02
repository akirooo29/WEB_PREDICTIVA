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
    [Authorize] // 1. PRIMER CANDADO: Nadie entra sin un Token JWT válido
    public class CursosController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public CursosController(ApplicationDbContext context)
        {
            _context = context;
        }

        // ========================================================================
        // CONSULTAS (GET) - Abierto a cualquier usuario logueado
        // ========================================================================

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Curso>>> GetCursos()
        {
            return await _context.Cursos.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Curso>> GetCurso(int id)
        {
            var curso = await _context.Cursos.FindAsync(id);
            if (curso == null) return NotFound();
            return curso;
        }

        // ========================================================================
        // MANTENIMIENTO (PUT, POST, DELETE) - Exclusivo para el Administrador
        // ========================================================================

        [Authorize(Roles = RolesConst.Administrador)] // 2. SEGUNDO CANDADO: Solo Admins
        [HttpPut("{id}")]
        public async Task<IActionResult> PutCurso(int id, Curso curso)
        {
            if (id != curso.Id) return BadRequest();

            _context.Entry(curso).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!CursoExists(id)) return NotFound();
                else throw;
            }

            return NoContent();
        }

        [Authorize(Roles = RolesConst.Administrador)]
        [HttpPost]
        public async Task<ActionResult<Curso>> PostCurso(Curso curso)
        {
            _context.Cursos.Add(curso);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetCurso", new { id = curso.Id }, curso);
        }

        [Authorize(Roles = RolesConst.Administrador)]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCurso(int id)
        {
            var curso = await _context.Cursos.FindAsync(id);
            if (curso == null) return NotFound();

            _context.Cursos.Remove(curso);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool CursoExists(int id)
        {
            return _context.Cursos.Any(e => e.Id == id);
        }
    }
}