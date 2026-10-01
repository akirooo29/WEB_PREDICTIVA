using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ApiAcademicaPredictiva.Common.Constants;
using ApiAcademicaPredictiva.Data.Entities;
using ApiAcademicaPredictiva.DTOs.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;

namespace ApiAcademicaPredictiva.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly RoleManager<IdentityRole> _roleManager;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        RoleManager<IdentityRole> roleManager,
        IConfiguration configuration,
        ILogger<AuthController> logger)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _roleManager = roleManager;
        _configuration = configuration;
        _logger = logger;
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponseDto>> Login([FromBody] LoginDto model)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var usuario = await _userManager.FindByEmailAsync(model.Email);
        if (usuario == null)
        {
            return Unauthorized(new AuthResponseDto
            {
                Exitoso = false,
                Mensaje = "Credenciales incorrectas."
            });
        }

        var resultado = await _signInManager.CheckPasswordSignInAsync(usuario, model.Password, lockoutOnFailure: false);
        if (!resultado.Succeeded)
        {
            return Unauthorized(new AuthResponseDto
            {
                Exitoso = false,
                Mensaje = "Credenciales incorrectas."
            });
        }

        var roles = await _userManager.GetRolesAsync(usuario);
        var (token, expiracion) = GenerarTokenJwt(usuario, roles);

        return Ok(new AuthResponseDto
        {
            Exitoso = true,
            Mensaje = "Inicio de sesión exitoso.",
            Token = token,
            Expiracion = expiracion,
            UsuarioId = usuario.Id,
            Email = usuario.Email,
            NombreCompleto = usuario.NombreCompleto,
            Roles = roles
        });
    }

    [HttpPost("registro")]
    public async Task<ActionResult<AuthResponseDto>> Registro([FromBody] RegistroDto model)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var usuarioExistente = await _userManager.FindByEmailAsync(model.Email);
        if (usuarioExistente != null)
        {
            return BadRequest(new AuthResponseDto
            {
                Exitoso = false,
                Mensaje = "El correo ya se encuentra registrado."
            });
        }

        var usuario = new ApplicationUser
        {
            UserName = model.Email,
            Email = model.Email,
            Nombres = model.Nombres,
            Apellidos = model.Apellidos,
            Dni = model.Dni,
            FechaRegistro = DateTime.UtcNow
        };

        var resultado = await _userManager.CreateAsync(usuario, model.Password);
        if (!resultado.Succeeded)
        {
            var errores = string.Join(", ", resultado.Errors.Select(e => e.Description));
            return BadRequest(new AuthResponseDto { Exitoso = false, Mensaje = errores });
        }

        // Asignar Rol
        var rolValido = RolesConst.Todos.Contains(model.Rol) ? model.Rol : RolesConst.Profesor;
        if (!await _roleManager.RoleExistsAsync(rolValido))
        {
            await _roleManager.CreateAsync(new IdentityRole(rolValido));
        }

        await _userManager.AddToRoleAsync(usuario, rolValido);

        var roles = new List<string> { rolValido };
        var (token, expiracion) = GenerarTokenJwt(usuario, roles);

        return Ok(new AuthResponseDto
        {
            Exitoso = true,
            Mensaje = "Usuario creado exitosamente.",
            Token = token,
            Expiracion = expiracion,
            UsuarioId = usuario.Id,
            Email = usuario.Email,
            NombreCompleto = usuario.NombreCompleto,
            Roles = roles
        });
    }

    private (string Token, DateTime Expiracion) GenerarTokenJwt(ApplicationUser usuario, IList<string> roles)
    {
        var jwtKey = _configuration["Jwt:Key"] ?? "TesisAcademicaPredictiva_SuperSecretKey_2026_JWT_Token_Secure_Auth!";
        var jwtIssuer = _configuration["Jwt:Issuer"] ?? "ApiAcademicaPredictiva";
        var jwtAudience = _configuration["Jwt:Audience"] ?? "ReactAppFrontend";
        var durationMinutes = double.Parse(_configuration["Jwt:DurationInMinutes"] ?? "720");

        var expiracion = DateTime.UtcNow.AddMinutes(durationMinutes);

        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, usuario.Id),
            new Claim(JwtRegisteredClaimNames.Email, usuario.Email ?? string.Empty),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim("nombre", usuario.NombreCompleto)
        };

        foreach (var rol in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, rol));
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var tokenDescriptor = new JwtSecurityToken(
            issuer: jwtIssuer,
            audience: jwtAudience,
            claims: claims,
            expires: expiracion,
            signingCredentials: creds
        );

        var token = new JwtSecurityTokenHandler().WriteToken(tokenDescriptor);
        return (token, expiracion);
    }
}
