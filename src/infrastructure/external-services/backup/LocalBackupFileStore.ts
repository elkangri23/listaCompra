/**
 * Almacén de ficheros de copias de seguridad sobre el sistema de ficheros
 * local (solo lectura).
 *
 * El directorio se monta en el contenedor de la API como volumen de solo
 * lectura (`/opt/listacompra/backups` del host → `/backups` en el
 * contenedor; ver docker-compose.prod.yml). El dump lo escribe
 * backup-prod.sh en el host; este almacén NUNCA escribe ni ejecuta nada.
 *
 * Protección contra path traversal: solo se usa el basename del filename
 * guardado en la fila de `backups`, y se verifica que la ruta resuelta
 * quede dentro del directorio base antes de leer.
 */

import { readFile } from 'node:fs/promises';
import { basename, relative, resolve } from 'node:path';

import type { IBackupFileStore } from '@application/ports/external/IBackupFileStore';

export class LocalBackupFileStore implements IBackupFileStore {
  private readonly baseDir: string;

  constructor(baseDir: string = process.env['BACKUP_DIR'] ?? '/backups') {
    this.baseDir = resolve(baseDir);
  }

  async read(filename: string): Promise<Buffer | null> {
    // basename: un filename guardado como "../../etc/passwd" se reduce a
    // "passwd", y la comprobación de prefijo bloquea cualquier escape.
    // (relative() en vez de startsWith para que funcione con el
    // separador de Windows también.)
    const safeName = basename(filename);
    const resolved = resolve(this.baseDir, safeName);
    const relativeToBase = relative(this.baseDir, resolved);
    if (relativeToBase.startsWith('..')) {
      return null;
    }
    try {
      return await readFile(resolved);
    } catch {
      // No existe en disco (o no se puede leer): el caso de uso lo
      // traduce a 404. No se distingue el motivo en la respuesta.
      return null;
    }
  }
}
