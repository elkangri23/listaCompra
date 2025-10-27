/*
  Warnings:

  - You are about to drop the column `email` on the `invitaciones` table. All the data in the column will be lost.
  - You are about to drop the column `estado` on the `invitaciones` table. All the data in the column will be lost.
  - You are about to drop the column `fechaAceptacion` on the `invitaciones` table. All the data in the column will be lost.
  - You are about to drop the column `invitadoPorId` on the `invitaciones` table. All the data in the column will be lost.
  - You are about to drop the column `fechaActualizacion` on the `permisos` table. All the data in the column will be lost.
  - You are about to drop the column `tipo` on the `permisos` table. All the data in the column will be lost.
  - Added the required column `tipoPermiso` to the `permisos` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "invitaciones" DROP CONSTRAINT "invitaciones_invitadoPorId_fkey";

-- AlterTable
ALTER TABLE "invitaciones" DROP COLUMN "email",
DROP COLUMN "estado",
DROP COLUMN "fechaAceptacion",
DROP COLUMN "invitadoPorId",
ADD COLUMN     "activa" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tipoPermiso" "TipoPermiso" NOT NULL DEFAULT 'LECTURA';

-- AlterTable
ALTER TABLE "permisos" DROP COLUMN "fechaActualizacion",
DROP COLUMN "tipo",
ADD COLUMN     "tipoPermiso" "TipoPermiso" NOT NULL;

-- DropEnum
DROP TYPE "EstadoInvitacion";
