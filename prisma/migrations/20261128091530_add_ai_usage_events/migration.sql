-- Seguimiento real de uso de IA (panel admin, fase 3): un evento por
-- llamada real al modelo (o intento fallido), sin datos inventados.
CREATE TABLE "ai_usage_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "cached" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_usage_events_createdAt_idx" ON "ai_usage_events"("createdAt");
CREATE INDEX "ai_usage_events_operation_idx" ON "ai_usage_events"("operation");
