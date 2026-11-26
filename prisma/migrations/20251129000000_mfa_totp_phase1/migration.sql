-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totpPendIntentos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totpSecret" TEXT;

-- CreateTable
CREATE TABLE "mfa_backup_codes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "usadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_backup_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_challenges" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "tipo" TEXT NOT NULL,
    "challenge" TEXT,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mfa_backup_codes_usuarioId_idx" ON "mfa_backup_codes"("usuarioId");

-- CreateIndex
CREATE INDEX "mfa_challenges_usuarioId_idx" ON "mfa_challenges"("usuarioId");

-- CreateIndex
CREATE INDEX "mfa_challenges_tipo_idx" ON "mfa_challenges"("tipo");

-- CreateIndex
CREATE INDEX "mfa_challenges_expiraAt_idx" ON "mfa_challenges"("expiraAt");

-- AddForeignKey
ALTER TABLE "mfa_backup_codes" ADD CONSTRAINT "mfa_backup_codes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfa_challenges" ADD CONSTRAINT "mfa_challenges_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

