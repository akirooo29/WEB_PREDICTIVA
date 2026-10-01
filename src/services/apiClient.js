// src/services/apiClient.js

export const apiClient = {
    get: async (url) => peticionSegura(url, 'GET'),
    post: async (url, data) => peticionSegura(url, 'POST', data)
};

async function peticionSegura(url, metodo, data = null) {
    // 1. Recuperamos el token que guardaremos en el navegador al hacer login
    const token = localStorage.getItem('token_jwt');

    // 2. Armamos las cabeceras, inyectando el token si existe
    const opciones = {
        method: metodo,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }) // <-- Aquí se inyecta el candado
        }
    };

    if (data) {
        opciones.body = JSON.stringify(data);
    }

    // 3. Hacemos la llamada al backend (C#)
    const respuesta = await fetch(url, opciones);

    // 4. Manejo de seguridad (Si el token expiró o es falso)
    if (respuesta.status === 401) {
        console.error("Acceso denegado: Token inválido o expirado.");
        localStorage.removeItem('token_jwt');
        window.location.reload(); // Obliga al usuario a loguearse de nuevo
        throw new Error("No autorizado");
    }

    if (!respuesta.ok) {
        throw new Error(`Error del servidor: ${respuesta.status}`);
    }

    return await respuesta.json();
}