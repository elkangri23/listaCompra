-- Añade la fecha de aceptación de los Términos de Servicio al registrarse (item 1: registro con términos)
ALTER TABLE "usuarios" ADD COLUMN "terminosAceptadosEn" TIMESTAMP(3);
