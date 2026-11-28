-- Copias de seguridad reales de la base de datos (panel admin, fase 6).
-- El backend solo REGISTRA y EXPONE: el dump y la restauración los hacen
-- scripts del host + cron en el VPS (backup-prod.sh, backup-watcher.sh,
-- restore-prod.sh), porque el contenedor de la API no puede ejecutar
-- comandos del host ni docker exec. Sin FK a usuarios (una copia
-- programada no tiene creador) y fuera de la cascada GDPR, igual que
-- ai_usage_events y login_attempts.
CREATE TABLE "backups" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restoreReason" TEXT,
    "restoredAt" TIMESTAMP(3),
    "restoreRequestedAt" TIMESTAMP(3),
    "restoreRequestedByUserId" TEXT,
    "failureReason" TEXT,

    CONSTRAINT "backups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "backups_status_createdAt_idx" ON "backups"("status", "createdAt");
CREATE INDEX "backups_createdAt_idx" ON "backups"("createdAt");
