-- MFA fase 2: credenciales passkey (WebAuthn)
CREATE TABLE "webauthn_credentials" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "contador" INTEGER NOT NULL DEFAULT 0,
    "transports" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "deviceType" TEXT NOT NULL DEFAULT 'singleDevice',
    "aaguid" TEXT,
    "nombre" TEXT NOT NULL DEFAULT 'Passkey',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoUso" TIMESTAMP(3),

    CONSTRAINT "webauthn_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webauthn_credentials_credentialId_key" ON "webauthn_credentials"("credentialId");
CREATE INDEX "webauthn_credentials_usuarioId_idx" ON "webauthn_credentials"("usuarioId");

ALTER TABLE "webauthn_credentials" ADD CONSTRAINT "webauthn_credentials_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
