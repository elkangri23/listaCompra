/*
  Warnings:

  - You are about to drop the column `error` on the `outbox_events` table. All the data in the column will be lost.
  - You are about to drop the column `fechaCreacion` on the `outbox_events` table. All the data in the column will be lost.
  - You are about to drop the column `fechaProcesado` on the `outbox_events` table. All the data in the column will be lost.
  - You are about to drop the column `maxAttempts` on the `outbox_events` table. All the data in the column will be lost.
  - You are about to drop the column `nextAttempt` on the `outbox_events` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[eventId]` on the table `outbox_events` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `aggregateType` to the `outbox_events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `eventId` to the `outbox_events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `occurredOn` to the `outbox_events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `outbox_events` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "outbox_events_processed_nextAttempt_idx";

-- AlterTable
ALTER TABLE "outbox_events" DROP COLUMN "error",
DROP COLUMN "fechaCreacion",
DROP COLUMN "fechaProcesado",
DROP COLUMN "maxAttempts",
DROP COLUMN "nextAttempt",
ADD COLUMN     "aggregateType" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "eventContext" JSONB,
ADD COLUMN     "eventId" TEXT NOT NULL,
ADD COLUMN     "eventVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "occurredOn" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_eventId_key" ON "outbox_events"("eventId");

-- CreateIndex
CREATE INDEX "outbox_events_processed_createdAt_idx" ON "outbox_events"("processed", "createdAt");

-- CreateIndex
CREATE INDEX "outbox_events_eventType_processed_idx" ON "outbox_events"("eventType", "processed");

-- CreateIndex
CREATE INDEX "outbox_events_aggregateId_aggregateType_idx" ON "outbox_events"("aggregateId", "aggregateType");

-- CreateIndex
CREATE INDEX "outbox_events_occurredOn_idx" ON "outbox_events"("occurredOn");
