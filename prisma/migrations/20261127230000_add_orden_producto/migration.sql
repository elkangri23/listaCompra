-- Orden de visualización de los productos dentro de una lista.
-- Lo usa PATCH /lists/:listaId/products/reorder (arrastre táctil y flechas ↑ ↓).
-- Los productos existentes quedan con orden 0 y el listado desempata por
-- fechaCreacion DESC, así que el orden visible no cambia hasta el primer reorden.
ALTER TABLE "productos" ADD COLUMN "orden" INTEGER NOT NULL DEFAULT 0;
