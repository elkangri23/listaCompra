-- Registro de inicios de sesión (panel admin, fase 5): un intento por
-- login, correcto o fallido, con el motivo real. Sin FK a usuarios (un
-- intento puede ser de un email inexistente) y fuera de la cascada GDPR,
-- igual que ai_usage_events. NUNCA se guardan contraseñas, códigos ni tokens.
CREATE TABLE "login_attempts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "login_attempts_email_createdAt_idx" ON "login_attempts"("email", "createdAt");
CREATE INDEX "login_attempts_createdAt_idx" ON "login_attempts"("createdAt");
