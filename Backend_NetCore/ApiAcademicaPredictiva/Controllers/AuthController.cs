using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ApiAcademicaPredictiva.Common.Constants;
using ApiAcademicaPredictiva.Data.Entities;
using ApiAcademicaPredictiva.DTOs.Auth; // Tus DTOs originales (LoginDto, RegistroDto, AuthResponseDto)
using Microsoft.AspNetCore.Authorization;
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

    // ========================================================================
    // 1. LOGIN PRINCIPAL (Modificado para soportar 2FA)
    // ========================================================================
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponseDto>> Login([FromBody] LoginDto model)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var usuario = await _userManager.FindByEmailAsync(model.Email);
        if (usuario == null)
            return Unauthorized(new AuthResponseDto { Exitoso = false, Mensaje = "Credenciales incorrectas." });

        var resultado = await _signInManager.CheckPasswordSignInAsync(usuario, model.Password, lockoutOnFailure: false);
        if (!resultado.Succeeded)
            return Unauthorized(new AuthResponseDto { Exitoso = false, Mensaje = "Credenciales incorrectas." });

        // --- INTERCEPTOR DE SEGURIDAD 2FA ---
        if (usuario.TwoFactorEnabled)
        {
            // No entregamos el token. Le decimos a React que pida el código de 6 dígitos.
            return Ok(new AuthResponseDto
            {
                Exitoso = true,
                Mensaje = "Verificación en 2 pasos requerida.",
                Token = "REQUIERE_2FA", // Bandera para tu Frontend
                Email = usuario.Email
            });
        }

        // --- FLUJO NORMAL (Si no tiene 2FA) ---
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

    // ========================================================================
    // 2. LOGIN CON CÓDIGO DE MICROSOFT AUTHENTICATOR
    // ========================================================================
    [HttpPost("login-2fa")]
    public async Task<ActionResult<AuthResponseDto>> Login2FA([FromBody] Login2FADto model)
    {
        var usuario = await _userManager.FindByEmailAsync(model.Email);
        if (usuario == null) return Unauthorized();

        var esValido = await _userManager.VerifyTwoFactorTokenAsync(usuario, _userManager.Options.Tokens.AuthenticatorTokenProvider, model.Codigo6Digitos);
        if (!esValido)
            return Unauthorized(new AuthResponseDto { Exitoso = false, Mensaje = "Código incorrecto o expirado." });

        // Código validado: Entregamos el Token final
        var roles = await _userManager.GetRolesAsync(usuario);
        var (token, expiracion) = GenerarTokenJwt(usuario, roles);

        return Ok(new AuthResponseDto
        {
            Exitoso = true,
            Mensaje = "Inicio de sesión seguro exitoso.",
            Token = token,
            Expiracion = expiracion,
            UsuarioId = usuario.Id,
            Email = usuario.Email,
            NombreCompleto = usuario.NombreCompleto,
            Roles = roles
        });
    }

    // ========================================================================
    // 3. REGISTRO (Tu código original intacto)
    // ========================================================================
    [HttpPost("registro")]
    public async Task<ActionResult<AuthResponseDto>> Registro([FromBody] RegistroDto model)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var usuarioExistente = await _userManager.FindByEmailAsync(model.Email);
        if (usuarioExistente != null)
            return BadRequest(new AuthResponseDto { Exitoso = false, Mensaje = "El correo ya se encuentra registrado." });

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
            return BadRequest(new AuthResponseDto { Exitoso = false, Mensaje = string.Join(", ", resultado.Errors.Select(e => e.Description)) });

        var rolValido = RolesConst.Todos.Contains(model.Rol) ? model.Rol : RolesConst.Profesor;
        if (!await _roleManager.RoleExistsAsync(rolValido)) await _roleManager.CreateAsync(new IdentityRole(rolValido));

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

    // ========================================================================
    // 4. CAMBIAR CONTRASEÑA (Protegido con JWT)
    // ========================================================================
    [Authorize]
    [HttpPost("cambiar-password")]
    public async Task<IActionResult> CambiarPassword([FromBody] CambiarPasswordDto model)
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? User.Identity!.Name;
        var user = await _userManager.FindByEmailAsync(email!);
        if (user == null) return Unauthorized("Usuario no encontrado.");

        var resultado = await _userManager.ChangePasswordAsync(user, model.PasswordActual, model.NuevaPassword);
        if (!resultado.Succeeded) return BadRequest(resultado.Errors.Select(e => e.Description));

        return Ok(new { mensaje = "Contraseña actualizada con éxito." });
    }

    // ========================================================================
    // 5. OBTENER QR DE MICROSOFT AUTHENTICATOR
    // ========================================================================
    [Authorize]
    [HttpGet("2fa-configurar")]
    public async Task<IActionResult> Configurar2FA()
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? User.Identity!.Name;
        var user = await _userManager.FindByEmailAsync(email!);
        if (user == null) return Unauthorized();

        var clave = await _userManager.GetAuthenticatorKeyAsync(user);
        if (string.IsNullOrEmpty(clave))
        {
            await _userManager.ResetAuthenticatorKeyAsync(user);
            clave = await _userManager.GetAuthenticatorKeyAsync(user);
        }

        var uriQr = $"otpauth://totp/AulaNorte_Predictiva:{Uri.EscapeDataString(user.Email!)}?secret={clave}&issuer=AulaNorte_Predictiva";
        return Ok(new { ClaveManual = clave, UriCodigoQr = uriQr });
    }

    // ========================================================================
    // 6. ACTIVAR EL 2FA EN LA BASE DE DATOS
    // ========================================================================
    [Authorize]
    [HttpPost("2fa-activar")]
    public async Task<IActionResult> Activar2FA([FromBody] Activar2FADto model)
    {
        var email = User.FindFirstValue(ClaimTypes.Email) ?? User.Identity!.Name;
        var user = await _userManager.FindByEmailAsync(email!);
        if (user == null) return Unauthorized();

        var esValido = await _userManager.VerifyTwoFactorTokenAsync(user, _userManager.Options.Tokens.AuthenticatorTokenProvider, model.Codigo6Digitos);
        if (!esValido) return BadRequest("El código es incorrecto.");

        await _userManager.SetTwoFactorEnabledAsync(user, true);
        return Ok(new { mensaje = "Seguridad en 2 pasos activada." });
    }

    // ========================================================================
    // MÉTODO AUXILIAR: GENERADOR DE JWT (Tu código original intacto)
    // ========================================================================
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
        var tokenDescriptor = new JwtSecurityToken(issuer: jwtIssuer, audience: jwtAudience, claims: claims, expires: expiracion, signingCredentials: creds);

        return (new JwtSecurityTokenHandler().WriteToken(tokenDescriptor), expiracion);
    }
}

// ========================================================================
// NUEVOS DTOs DE SEGURIDAD (Se agregan aquí para compilar inmediatamente)
// ========================================================================
public class CambiarPasswordDto
{
    public string PasswordActual { get; set; } = string.Empty;
    public string NuevaPassword { get; set; } = string.Empty;
}

public class Activar2FADto
{
    public string Codigo6Digitos { get; set; } = string.Empty;
}

public class Login2FADto
{
    public string Email { get; set; } = string.Empty;
    public string Codigo6Digitos { get; set; } = string.Empty;
}