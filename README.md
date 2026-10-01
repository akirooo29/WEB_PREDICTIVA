# Sistema Web Predictivo - Gestión y Rendimiento Académico

Repositorio central del proyecto de tesis. Arquitectura compuesta por 3 componentes:
- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** ASP.NET Core Web API (.NET 8/9)
- **Motor Predictivo:** Python + Flask + Scikit-Learn (Random Forest)

---

## Requisitos previos

Instalar en tu computadora:
- [Node.js](https://nodejs.org/) (versión 18+ o superior)
- [.NET SDK](https://dotnet.microsoft.com/download) (versión 8.0 o superior)
- [Python](https://www.python.org/downloads/) (versión 3.10 o superior)
- [Git](https://git-scm.com/)

---

## 1. Clonar el proyecto

Abre una terminal y clona el repositorio:

```bash
git clone https://github.com/akirooo29/WEB_PREDICTIVA.git
cd WEB_PREDICTIVA
```

---

## 2. Puesta en marcha (Levantar los 3 Servicios)

Abre **3 terminales independientes** dentro de la carpeta raíz del proyecto para ejecutar cada microservicio:

### Terminal 1: Motor Predictivo IA (Python + Flask)
Escucha en: `http://127.0.0.1:5000`

```bash
cd Motor_Predictivo_IA

# Instalar dependencias requeridas
pip install -r requirements.txt
# (o manualmente: pip install flask pandas scikit-learn)

# Iniciar servidor Flask
python api_ia.py
```

---

### Terminal 2: Backend API (.NET Core)
Escucha en: `https://localhost:7198` / `http://localhost:5247`  
Swagger UI: `http://localhost:5247/swagger`

```bash
cd Backend_NetCore/ApiAcademicaPredictiva

# Restaurar paquetes NuGet y ejecutar
dotnet run
```

> **Nota:** Verifica que tu cadena de conexión en `appsettings.json` apunte a tu instancia local de SQL Server.

---

### Terminal 3: Frontend (React + Vite)
Disponible en: `http://127.0.0.1:5173`

```bash
# Desde la raíz del proyecto (o carpeta Frontend):
npm install

# Iniciar entorno de desarrollo
npm run dev
```

---

## Mapa de Puertos y Servicios

| Componente | Tecnología | URL / Puerto |
| :--- | :--- | :--- |
| **Motor IA** | Python / Flask | `http://127.0.0.1:5000` |
| **Backend API** | ASP.NET Core (.NET) | `http://localhost:5247` (o `https://localhost:7198`) |
| **Frontend** | React / Vite | `http://127.0.0.1:5173` |

---

## Notas de Desarrollo
- El archivo `.gitignore` ya está configurado para omitir `node_modules`, `dist`, `bin`, `obj`, entornos virtuales de Python (`venv/`, `.venv/`) y archivos temporales.
- Nunca hagas commit de secretos ni contraseñas de bases de datos de producción.
