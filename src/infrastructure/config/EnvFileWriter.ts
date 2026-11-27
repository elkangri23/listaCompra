/**
 * Escritor de variables de entorno en el fichero .env (Opción B, CU-31)
 *
 * Permite que los cambios de configuración de IA hechos por el admin desde
 * el panel (PUT /api/v1/ai/admin/config) sobrevivan a reinicios y
 * reinstalaciones: el .env sigue siendo la única fuente de verdad, pero el
 * servicio lo actualiza al aplicar un cambio en caliente.
 *
 * - Preserva todas las demás líneas del fichero (comentarios, orden, otros
 *   valores).
 * - Escritura atómica: fichero temporal + rename para no dejar un .env
 *   corrupto si el proceso muere a mitad.
 * - Nunca lanza: devuelve false si no puede escribir (el runtime sigue
 *   funcionando con la config en memoria).
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@infrastructure/observability/logger/Logger';

const logger = new Logger('EnvFileWriter');

export function resolveEnvFilePath(): string {
  return (
    process.env['ENV_FILE_PATH'] || path.join(process.cwd(), '.env')
  );
}

function serializeLine(key: string, value: string): string {
  // Comillas solo si hace falta (espacios, #, comillas, saltos de línea)
  const needsQuotes =
    value === '' ||
    /[\s"'#,]/.test(value) ||
    value !== value.trim();
  const escaped = value.replace(/'/g, '\\\'');
  return needsQuotes ? `${key}='${escaped}'` : `${key}=${escaped}`;
}

function upsertLine(lines: string[], key: string, value: string): boolean {
  const pattern = new RegExp(`^\\s*#?\\s*${key}\\s*=`);
  const newLine = serializeLine(key, value);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) break;
    if (pattern.test(line)) {
      // No marcar como cambio si el valor ya coincide (sin comillas)
      if (line === `${key}=${value}` || line === newLine) {
        return false;
      }
      lines[i] = newLine;
      return true;
    }
  }

  lines.push(newLine);
  return true;
}

/**
 * Actualiza (o crea) variables en el fichero .env de forma atómica.
 *
 * @param updates Mapa clave -> valor a escribir
 * @param envPath  Ruta del fichero (por defecto ENV_FILE_PATH o ./.env)
 * @returns true si el fichero cambió; false si no hubo cambios o falló
 */
export function persistEnvVars(
  updates: Record<string, string>,
  envPath?: string
): boolean {
  const target = envPath ?? resolveEnvFilePath();

  try {
    const raw = fs.existsSync(target)
      ? fs.readFileSync(target, 'utf-8')
      : '';

    // Normalizar saltos de línea y respetar CRLF del original
    const usesCrlf = raw.includes('\r\n');
    const lines = raw.split(/\r?\n/);

    let changed = false;
    for (const [key, value] of Object.entries(updates)) {
      if (!key || !/^[A-Z0-9_]+$/i.test(key)) {
        logger.warn('Nombre de variable inválido, ignorado', { key });
        continue;
      }
      changed = upsertLine(lines, key, value) || changed;
    }

    if (!changed) {
      return false;
    }

    // Eliminar posibles líneas finales vacías duplicadas por el upsert
    const output = lines
      .join(usesCrlf ? '\r\n' : '\n')
      .replace(/\n{3,}$/, '\n');

    const tmpPath = `${target}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmpPath, output, 'utf-8');
    fs.renameSync(tmpPath, target);

    logger.info('Variables de entorno persistidas en .env', {
      envPath: target,
      keys: Object.keys(updates),
    });
    return true;
  } catch (error) {
    logger.error('No se pudo persistir el .env', error as Error, {
      envPath: target,
    });
    return false;
  }
}
