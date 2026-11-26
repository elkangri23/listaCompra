-- Códigos de verificación de email (item 3): 6 dígitos, HMAC guardado,
-- un solo uso, 15 minutos de vida. Las cuentas ya existentes quedan
-- marcadas como verificadas para no bloquearlas (el registro con código
-- es posterior a su creación).
CREATE TABLE "email_verification_codes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "expiraAt" TIMESTAMP(3) NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "usadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_verification_codes_usuarioId_idx" ON "email_verification_codes"("usuarioId");
CREATE INDEX "email_verification_codes_expiraAt_idx" ON "email_verification_codes"("expiraAt");

ALTER TABLE "email_verification_codes" ADD CONSTRAINT "email_verification_codes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "usuarios" SET "emailVerificado" = true WHERE "emailVerificado" = false;
