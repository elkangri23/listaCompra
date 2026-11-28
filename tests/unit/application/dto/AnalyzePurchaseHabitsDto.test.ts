/**
 * Tests unitarios para el DTO de Análisis de Hábitos de Compra (CU-30)
 */

import {
  TIME_RANGE_PRESETS,
  PRESET_DAYS,
  validateAnalyzePurchaseHabitsDto
} from '../../../../src/application/dto/ai/AnalyzePurchaseHabitsDto';

const VALID_UUID = '5f0b8a4e-1c2d-4e3f-8a9b-2c3d4e5f6a7b';

describe('AnalyzePurchaseHabitsDto', () => {
  describe('constantes', () => {
    it('expone los 4 presets de rango temporal', () => {
      expect(TIME_RANGE_PRESETS).toEqual(['30d', '90d', '365d', 'all']);
    });

    it('mapea cada preset a sus días (null = todo el historial)', () => {
      expect(PRESET_DAYS['30d']).toBe(30);
      expect(PRESET_DAYS['90d']).toBe(90);
      expect(PRESET_DAYS['365d']).toBe(365);
      expect(PRESET_DAYS['all']).toBeNull();
    });
  });

  describe('validateAnalyzePurchaseHabitsDto', () => {
    it('valida entrada correcta sin timeRange (default 90d)', () => {
      const dto = validateAnalyzePurchaseHabitsDto({ userId: VALID_UUID });
      expect(dto).toEqual({ userId: VALID_UUID, timeRange: '90d' });
    });

    it('acepta todos los presets válidos', () => {
      for (const preset of TIME_RANGE_PRESETS) {
        const dto = validateAnalyzePurchaseHabitsDto({
          userId: VALID_UUID,
          timeRange: preset
        });
        expect(dto.timeRange).toBe(preset);
      }
    });

    it('rechaza un userId que no es UUID', () => {
      expect(() => validateAnalyzePurchaseHabitsDto({ userId: 'abc' })).toThrow(
        /ID de usuario inválido/
      );
    });

    it('rechaza un timeRange fuera del enum', () => {
      expect(() =>
        validateAnalyzePurchaseHabitsDto({ userId: VALID_UUID, timeRange: '7h' })
      ).toThrow(/timeRange/);
    });

    it('rechaza entrada sin userId', () => {
      expect(() => validateAnalyzePurchaseHabitsDto({})).toThrow(/userId/);
    });
  });
});
