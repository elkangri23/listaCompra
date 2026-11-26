-- GDPR (item 15): fecha de solicitud de eliminación de cuenta + borrado en
-- cascada de los datos del usuario (listas, productos creados, permisos y
-- plantillas). Las FK pasaban de ON DELETE RESTRICT a ON DELETE CASCADE.
ALTER TABLE "usuarios" ADD COLUMN "eliminacionSolicitadaEn" TIMESTAMP(3);

ALTER TABLE "listas" DROP CONSTRAINT "listas_propietarioId_fkey";
ALTER TABLE "listas" ADD CONSTRAINT "listas_propietarioId_fkey" FOREIGN KEY ("propietarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "productos" DROP CONSTRAINT "productos_creadoPorId_fkey";
ALTER TABLE "productos" ADD CONSTRAINT "productos_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "permisos" DROP CONSTRAINT "permisos_usuarioId_fkey";
ALTER TABLE "permisos" ADD CONSTRAINT "permisos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "blueprints" DROP CONSTRAINT "blueprints_creadoPorId_fkey";
ALTER TABLE "blueprints" ADD CONSTRAINT "blueprints_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
