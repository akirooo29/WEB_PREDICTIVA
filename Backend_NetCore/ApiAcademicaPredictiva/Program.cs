using System.Text;
using ApiAcademicaPredictiva.Data;
using ApiAcademicaPredictiva.Data.Entities;
using ApiAcademicaPredictiva.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);

// =========================================================================
// 1. CONTROLADORES Y CONFIGURACIÓN BASE
// =========================================================================
builder.Services.AddControllers().AddJsonOptions(opciones =>
{
    opciones.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
});
builder.Services.AddEndpointsApiExplorer();

// =========================================================================
// 2. CONFIGURACIÓN DE SWAGGER CON AUTORIZACIÓN JWT
// =========================================================================
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "API Sistema Académico Predictivo",
        Version = "v1",
        Description = "Backend de gestión académica integrado con React y microservicio IA (Random Forest)."
    });

    // Soporte para ingresar Bearer Token directamente en Swagger UI
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Ingrese su token JWT en el formato: Bearer {su_token}"
    });

    c.AddSecurityRequirement(_ => new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecuritySchemeReference("Bearer"),
            new List<string>()
        }
    });
});

// =========================================================================
// 3. CONEXIÓN A BASE DE DATOS (SQL Server + EF Core)
// =========================================================================
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("No se encontró la cadena de conexión 'DefaultConnection' en appsettings.json.");

builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseSqlServer(connectionString, sqlOptions =>
    {
        sqlOptions.EnableRetryOnFailure(
            maxRetryCount: 5,
            maxRetryDelay: TimeSpan.FromSeconds(10),
            errorNumbersToAdd: null);
    });
});

// =========================================================================
// 4. CONFIGURACIÓN DE ASP.NET CORE IDENTITY
// =========================================================================
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    // Políticas de contraseñas adaptadas para el entorno académico
    options.Password.RequireDigit = true;
    options.Password.RequiredLength = 6;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = false;
    options.Password.RequireLowercase = true;

    // Políticas de usuario
    options.User.RequireUniqueEmail = true;
})
.AddEntityFrameworkStores<ApplicationDbContext>()
.AddDefaultTokenProviders();

// =========================================================================
// 5. AUTENTICACIÓN Y AUTORIZACIÓN CON JWT BEARER
// =========================================================================
var jwtKey = builder.Configuration["Jwt:Key"] 
    ?? "TesisAcademicaPredictiva_SuperSecretKey_2026_JWT_Token_Secure_Auth!";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "ApiAcademicaPredictiva";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "ReactAppFrontend";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.SaveToken = true;
    options.RequireHttpsMetadata = false; // Facilitar pruebas en desarrollo local
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();

// =========================================================================
// 6. POLÍTICA DE CORS (Integración con Frontend React)
// =========================================================================
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:5173", "http://localhost:3000" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactAppPolicy", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// =========================================================================
// 7. INYECCIÓN DEL SERVICIO DE IA (Consumo de Python vía IHttpClientFactory)
// =========================================================================
builder.Services.AddHttpClient<IPrediccionService, PrediccionService>(client =>
{
    var iaBaseUrl = builder.Configuration["IaMicroservice:BaseUrl"] ?? "http://localhost:5000";
    client.BaseAddress = new Uri(iaBaseUrl.TrimEnd('/') + "/");
    client.Timeout = TimeSpan.FromSeconds(20);
});

var app = builder.Build();

// =========================================================================
// PIPELINE DE MIDDLEWARES HTTP
// =========================================================================
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "API Académica Predictiva v1");
        c.RoutePrefix = string.Empty; // Swagger UI visible en la raíz http://localhost:PORT/
    });
}

// Activar política CORS antes de Autenticación
app.UseCors("ReactAppPolicy");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// =========================================================================
// INICIALIZACIÓN Y SEMBRADO DE DATOS (SEEDING) EN DESARROLLO
// =========================================================================
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var services = scope.ServiceProvider;
    try
    {
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
        var context = services.GetRequiredService<ApplicationDbContext>();

        await DbSeeder.SeedAsync(roleManager, userManager, context);
        app.Logger.LogInformation(">>> Base de datos sembrada con roles y usuarios demo exitosamente.");
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, ">>> Ocurrió un error al ejecutar el sembrado de datos en DbSeeder.");
    }
}

app.Run();
