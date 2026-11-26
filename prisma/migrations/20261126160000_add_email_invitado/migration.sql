-- Añade el email del invitado a las invitaciones (13A: bandeja de invitaciones pendientes)
ALTER TABLE "invitaciones" ADD COLUMN "emailInvitado" TEXT;
