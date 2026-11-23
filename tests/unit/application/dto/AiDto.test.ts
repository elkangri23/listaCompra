/**
 * Tests unitarios para DTOs de IA (CU-29 y CU-33)
 * Validaciones puras sin dependencias externas.
 */

import {
  BulkCategorizeProductsDtoValidator,
  BulkCategorizeProductsDtoFactory
} from '@application/dto/ai/BulkCategorizeProductsDto';
import {
  DEFAULT_RECOMMENDATIONS_CONFIG
} from '@application/dto/products/GetProductRecommendationsDto';

describe('BulkCategorizeProductsDtoValidator (CU-29)', () => {
  const validProduct = { nombre: 'Leche' };

  it('acepta un DTO válido', () => {
    expect(() => BulkCategorizeProductsDtoValidator.validate({
      products: [validProduct, { nombre: 'Pan' }]
    } as any)).not.toThrow();
  });

  it('rechaza products vacío', () => {
    expect(() => BulkCategorizeProductsDtoValidator.validate({ products: [] } as any))
      .toThrow(/at least/i);
  });

  it('rechaza products no-array', () => {
    expect(() => BulkCategorizeProductsDtoValidator.validate({ products: 'no' } as any))
      .toThrow(/array/i);
  });

  it('rechaza más de 50 productos', () => {
    const products = Array.from({ length: 51 }, (_, i) => ({ nombre: `P${i}` }));
    expect(() => BulkCategorizeProductsDtoValidator.validate({ products } as any))
      .toThrow(/at most|maximum|exceed/i);
  });

  it('rechaza producto sin nombre', () => {
    expect(() => BulkCategorizeProductsDtoValidator.validate({ products: [{ nombre: '' }] } as any))
      .toThrow();
  });

  it('rechaza tiendaId con formato inválido', () => {
    expect(() => BulkCategorizeProductsDtoValidator.validate({
      products: [validProduct], tiendaId: 'no-es-uuid'
    } as any)).toThrow();
  });

  it('acepta tiendaId UUID válido', () => {
    expect(() => BulkCategorizeProductsDtoValidator.validate({
      products: [validProduct],
      tiendaId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
    } as any)).not.toThrow();
  });

  it('rechaza enrichWithExistingCategories no-booleano', () => {
    expect(() => BulkCategorizeProductsDtoValidator.validate({
      products: [validProduct], enrichWithExistingCategories: 'yes'
    } as any)).toThrow(/boolean/i);
  });
});

describe('BulkCategorizeProductsDtoFactory (CU-29)', () => {
  it('create valida y devuelve el DTO normalizado', () => {
    const dto = BulkCategorizeProductsDtoFactory.create({
      products: [{ nombre: 'Leche', descripcion: 'Entera' }]
    });

    expect(dto.products).toHaveLength(1);
    expect(dto.products[0]?.nombre).toBe('Leche');
  });

  it('create lanza con payload inválido', () => {
    expect(() => BulkCategorizeProductsDtoFactory.create({ products: [] })).toThrow();
  });

  it('fromHttpRequest extrae body', () => {
    const dto = BulkCategorizeProductsDtoFactory.fromHttpRequest({
      products: [{ nombre: 'Pan' }],
      tiendaId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      enrichWithExistingCategories: true
    });

    expect(dto.products[0]?.nombre).toBe('Pan');
    expect(dto.enrichWithExistingCategories).toBe(true);
  });

  it('fromHttpRequest lanza sin body', () => {
    expect(() => BulkCategorizeProductsDtoFactory.fromHttpRequest(null)).toThrow(/required/i);
    expect(() => BulkCategorizeProductsDtoFactory.fromHttpRequest('texto')).toThrow(/required/i);
  });
});

describe('DEFAULT_RECOMMENDATIONS_CONFIG (CU-33)', () => {
  it('expone configuración por defecto coherente', () => {
    expect(DEFAULT_RECOMMENDATIONS_CONFIG).toBeTruthy();
    const cfg = DEFAULT_RECOMMENDATIONS_CONFIG as Record<string, unknown>;
    expect(Object.keys(cfg).length).toBeGreaterThan(0);
  });
});
