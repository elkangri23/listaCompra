/**
 * Tests unitarios para match-past-examples
 * Emparejador puro: normalización, puntuación, diversidad y recencia.
 */

import {
  matchPastExamples,
  normalizeProductName,
  tokenizeProductName,
  scoreExampleSimilarity,
  type PastCategorizedProduct
} from '../../../../src/application/use-cases/ai/match-past-examples';

const product = (productName: string, category: string, updatedAt: string): PastCategorizedProduct => ({
  productName,
  category,
  updatedAt: new Date(updatedAt)
});

describe('normalizeProductName', () => {
  it('minúsculas, sin tildes ni puntuación', () => {
    expect(normalizeProductName('Café con Leche!')).toBe('cafe con leche');
    expect(normalizeProductName('  LECHE  1L ')).toBe('leche 1l');
  });
});

describe('tokenizeProductName', () => {
  it('quita stopwords', () => {
    expect(tokenizeProductName('Pan de molde')).toEqual(['pan', 'molde']);
    expect(tokenizeProductName('Leche')).toEqual(['leche']);
    expect(tokenizeProductName('de la')).toEqual([]);
  });
});

describe('scoreExampleSimilarity', () => {
  it('coincidencia exacta es 1', () => {
    expect(scoreExampleSimilarity(['leche'], ['leche'])).toBe(1);
  });

  it('sin tokens en común es 0', () => {
    expect(scoreExampleSimilarity(['leche'], ['pan'])).toBe(0);
  });

  it('proporción de tokens del producto nuevo', () => {
    expect(scoreExampleSimilarity(['leche', 'desnatada'], ['leche', 'entera'])).toBe(0.5);
  });

  it('prefijo suma bonificación sin pasar de 1', () => {
    expect(scoreExampleSimilarity(['pan', 'molde'], ['pan'])).toBeCloseTo(0.7);
  });
});

describe('matchPastExamples', () => {
  it('devuelve [] sin historial', () => {
    expect(matchPastExamples('Leche', [])).toEqual([]);
  });

  it('devuelve [] sin tokens con contenido', () => {
    expect(matchPastExamples('de la', [product('Leche', 'Lácteos', '2026-11-20T10:00:00Z')])).toEqual([]);
  });

  it('ordena por parecido y prefiere el más reciente en empate', () => {
    const history = [
      product('Leche entera', 'Lácteos', '2026-11-20T10:00:00Z'),
      product('Leche desnatada', 'Lácteos', '2026-11-21T10:00:00Z'),
      product('Pan de molde', 'Panadería', '2026-11-22T10:00:00Z')
    ];
    expect(matchPastExamples('Leche semidesnatada', history)).toEqual([
      { productName: 'Leche desnatada', category: 'Lácteos' },
      { productName: 'Leche entera', category: 'Lácteos' }
    ]);
  });

  it('ignora tildes y mayúsculas al comparar', () => {
    const history = [product('Café molido', 'Café', '2026-11-20T10:00:00Z')];
    expect(matchPastExamples('cafe', history)).toEqual([
      { productName: 'Café molido', category: 'Café' }
    ]);
  });

  it('limita a 2 ejemplos por categoría aunque haya más parecidos', () => {
    const history = [
      product('Leche entera', 'Lácteos', '2026-11-20T10:00:00Z'),
      product('Leche desnatada', 'Lácteos', '2026-11-21T10:00:00Z'),
      product('Leche semidesnatada', 'Lácteos', '2026-11-22T10:00:00Z'),
      product('Leche de avena', 'Lácteos', '2026-11-23T10:00:00Z'),
      product('Leche condensada', 'Bebidas', '2026-11-24T10:00:00Z')
    ];
    const result = matchPastExamples('Leche', history);
    expect(result.filter(e => e.category === 'Lácteos')).toHaveLength(2);
    expect(result).toContainEqual({ productName: 'Leche condensada', category: 'Bebidas' });
  });

  it('respeta maxExamples', () => {
    const history = Array.from({ length: 10 }, (_, i) =>
      product(`Leche ${i}`, `Categoría ${i}`, `2026-11-2${i % 10}T10:00:00Z`)
    );
    expect(matchPastExamples('Leche', history, 3)).toHaveLength(3);
  });
});
