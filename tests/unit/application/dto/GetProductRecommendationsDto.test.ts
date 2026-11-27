/**
 * Tests unitarios para el DTO de Recomendaciones Contextuales (CU-33)
 */

import {
  validateGetProductRecommendationsDto,
  applyRecommendationsDefaults,
  DEFAULT_RECOMMENDATIONS_CONFIG,
  type GetProductRecommendationsDto
} from '../../../../src/application/dto/products/GetProductRecommendationsDto';

const valid: GetProductRecommendationsDto = { listId: 'lista-1' };

describe('GetProductRecommendationsDto', () => {
  describe('validateGetProductRecommendationsDto', () => {
    it('acepta un DTO válido mínimo', () => {
      const result = validateGetProductRecommendationsDto(valid);
      expect(result).toEqual({ valid: true, errors: [] });
    });

    it('acepta un DTO válido con todos los campos', () => {
      const result = validateGetProductRecommendationsDto({
        listId: 'lista-1',
        maxRecommendations: 10,
        productId: 'p-1',
        context: 'desayuno',
        categoryId: 'c-1',
        storeId: 's-1',
        includeUserHistory: false,
        excludeExisting: false,
        creativityLevel: 'creative'
      });
      expect(result.valid).toBe(true);
    });

    it('rechaza listId vacío o no string', () => {
      expect(validateGetProductRecommendationsDto({} as any).errors).toContain(
        'listId es requerido y debe ser un string válido'
      );
      expect(validateGetProductRecommendationsDto({ listId: '  ' }).errors).toContain(
        'listId es requerido y debe ser un string válido'
      );
    });

    it('rechaza maxRecommendations no numérico, fuera de rango o decimal', () => {
      const noNumero = validateGetProductRecommendationsDto({
        listId: 'l',
        maxRecommendations: '5' as any
      });
      expect(noNumero.errors).toContain('maxRecommendations debe ser un número');

      const fueraRango = validateGetProductRecommendationsDto({
        listId: 'l',
        maxRecommendations: 25
      });
      expect(fueraRango.errors).toContain('maxRecommendations debe estar entre 1 y 20');

      const decimal = validateGetProductRecommendationsDto({
        listId: 'l',
        maxRecommendations: 2.5
      });
      expect(decimal.errors).toContain('maxRecommendations debe ser un número entero');
    });

    it('rechaza productId, categoryId y storeId vacíos si se proporcionan', () => {
      const result = validateGetProductRecommendationsDto({
        listId: 'l',
        productId: '',
        categoryId: '   ',
        storeId: undefined as any
      });
      expect(result.errors).toContain('productId debe ser un string válido si se proporciona');
      expect(result.errors).toContain('categoryId debe ser un string válido si se proporciona');
    });

    it('rechaza context vacío o demasiado largo', () => {
      const vacio = validateGetProductRecommendationsDto({ listId: 'l', context: ' ' });
      expect(vacio.errors).toContain('context debe ser un string válido si se proporciona');

      const largo = validateGetProductRecommendationsDto({
        listId: 'l',
        context: 'x'.repeat(101)
      });
      expect(largo.errors).toContain('context no debe exceder 100 caracteres');
    });

    it('rechaza flags no booleanos', () => {
      const result = validateGetProductRecommendationsDto({
        listId: 'l',
        includeUserHistory: 'true' as any,
        excludeExisting: 1 as any
      });
      expect(result.errors).toContain('includeUserHistory debe ser un booleano');
      expect(result.errors).toContain('excludeExisting debe ser un booleano');
    });

    it('rechaza creativityLevel fuera del enum', () => {
      const result = validateGetProductRecommendationsDto({
        listId: 'l',
        creativityLevel: 'locura' as any
      });
      expect(result.errors[0]).toMatch(/creativityLevel debe ser uno de/);
    });

    it('acumula múltiples errores', () => {
      const result = validateGetProductRecommendationsDto({
        listId: '',
        creativityLevel: 'x' as any
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('applyRecommendationsDefaults', () => {
    it('aplica los valores por defecto a campos opcionales ausentes', () => {
      const result = applyRecommendationsDefaults({ listId: 'l' });
      expect(result.maxRecommendations).toBe(DEFAULT_RECOMMENDATIONS_CONFIG.maxRecommendations);
      expect(result.includeUserHistory).toBe(true);
      expect(result.excludeExisting).toBe(true);
      expect(result.creativityLevel).toBe('balanced');
    });

    it('conserva los valores explícitos del usuario', () => {
      const result = applyRecommendationsDefaults({
        listId: 'l',
        maxRecommendations: 12,
        includeUserHistory: false,
        excludeExisting: false,
        creativityLevel: 'creative',
        context: 'cena'
      });
      expect(result.maxRecommendations).toBe(12);
      expect(result.includeUserHistory).toBe(false);
      expect(result.excludeExisting).toBe(false);
      expect(result.creativityLevel).toBe('creative');
      expect(result.context).toBe('cena');
    });
  });
});
