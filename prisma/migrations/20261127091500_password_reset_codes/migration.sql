-- Restablecimiento de contraseña por código (item 9c): misma forma que
-- email_verification_codes (item 3), tabla separada para no mezclar usos.
CREATE TABLE "password_reset_codes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "expiraAt" TIMESTAMP(3) NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "usadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "password_reset_codes_usuarioId_idx" ON "password_reset_codes"("usuarioId");
CREATE INDEX "password_reset_codes_expiraAt_idx" ON "password_reset_codes"("expiraAt");

ALTER TABLE "password_reset_codes" ADD CONSTRAINT "password_reset_codes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
