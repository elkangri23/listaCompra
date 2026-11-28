/**
 * Puerto del almacén de ficheros de copias de seguridad.
 *
 * El backend solo LEE los dumps: el directorio se monta en el contenedor
 * de la API como volumen de solo lectura (`/opt/listacompra/backups`
 * del host → `/backups` en el contenedor; ver docker-compose.prod.yml).
 * El dump lo escribe backup-prod.sh en el host; el backend nunca escribe
 * ni ejecuta nada en el host.
 *
 * La implementación DEBE protegerse contra path traversal: usa solo el
 * basename del filename guardado y verifica que la ruta resuelta quede
 * dentro del directorio base.
 */
export interface IBackupFileStore {
  /**
   * Contenido del fichero, o null si no existe en disco. `filename` es el
   * nombre guardado en la fila de `backups` (sin directorios).
   */
  read(filename: string): Promise<Buffer | null>;
}
