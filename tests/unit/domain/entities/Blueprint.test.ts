/**
 * Tests unitarios para la entidad Blueprint
 */

import { Blueprint, ProductoPlantilla } from "../../../../src/domain/entities/Blueprint";

describe("Blueprint Entity", () => {
  const sampleProducts: ProductoPlantilla[] = [
    {
      nombre: "Leche",
      cantidad: 2,
      notas: "Preferiblemente deslactosada",
      categoriaId: "550e8400-e29b-41d4-a716-446655440000"
    },
    {
      nombre: "Pan",
      cantidad: 1
    }
  ];

  describe("crear", () => {
    it("deber�a crear un blueprint v�lido", () => {
      const result = Blueprint.crear(
        "Lista b�sica",
        "Productos esenciales para el hogar",
        false,
        sampleProducts,
        "user-001"
      );

      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        const blueprint = result.value;
        expect(blueprint.nombre).toBe("Lista b�sica");
        expect(blueprint.descripcion).toBe("Productos esenciales para el hogar");
        expect(blueprint.publico).toBe(false);
        expect(blueprint.productos).toHaveLength(2);
        expect(blueprint.creadoPorId).toBe("user-001");
      }
    });

    it("deber�a fallar con nombre vac�o", () => {
      const result = Blueprint.crear(
        "",
        "Descripci�n v�lida",
        false,
        sampleProducts,
        "user-001"
      );

      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error.message).toContain("El nombre no puede estar vacío");
      }
    });
  });
});
