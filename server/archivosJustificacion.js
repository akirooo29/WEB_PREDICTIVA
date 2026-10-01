import { randomUUID } from 'node:crypto';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const maximoBytes = 500 * 1024;
const tipos = {
  'application/pdf': { extension: '.pdf', firma: (buffer) => buffer.subarray(0, 5).toString() === '%PDF-' },
  'image/jpeg': { extension: '.jpg', firma: (buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
  'image/png': { extension: '.png', firma: (buffer) => buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
};

export function guardarAdjuntoLocal(archivo, carpeta) {
  if (!archivo) return null;
  const tipo = tipos[archivo.tipo];
  if (!tipo || typeof archivo.base64 !== 'string' || archivo.base64.length > Math.ceil(maximoBytes * 4 / 3) + 8) {
    throw new Error('Adjunta solo un PDF o imagen PNG/JPG de hasta 500 KB.');
  }
  const bytes = Buffer.from(archivo.base64.replace(/^data:[^,]+,/, ''), 'base64');
  if (bytes.length === 0 || bytes.length > maximoBytes || !tipo.firma(bytes)) {
    throw new Error('El archivo está vacío, supera 500 KB o no coincide con su formato.');
  }
  const nombre = String(archivo.nombre || 'justificacion').replace(/[\\/\0]/g, '_').slice(0, 100);
  const nombreInterno = `${randomUUID()}${tipo.extension}`;
  const ruta = join(carpeta, nombreInterno);
  writeFileSync(ruta, bytes, { flag: 'wx' });
  return { ruta: nombreInterno, nombre, rutaCompleta: ruta };
}

export function eliminarAdjuntoLocal(ruta) {
  if (ruta && existsSync(ruta)) unlinkSync(ruta);
}
