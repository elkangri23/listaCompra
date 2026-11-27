/**
 * Emparejador de ejemplos pasados para sugerencias de categorías.
 * Puro y testeable: dado el nombre de un producto nuevo y el historial de
 * productos ya categorizados por el usuario, devuelve los ejemplos más
 * parecidos, diversos por categoría, para que la IA siga el criterio del usuario.
 */

export interface PastCategorizedProduct {
  productName: string;
  category: string;
  updatedAt: Date;
}

export interface PastCategoryExample {
  productName: string;
  category: string;
}

/** Palabras sin contenido para comparar nombres de producto. */
const STOPWORDS = new Set([
  'de', 'la', 'el', 'los', 'las', 'con', 'en', 'y', 'a', 'para', 'sin',
  'del', 'al', 'un', 'una', 'unos', 'unas', 'su', 'sus', 'por', 'o', 'e', 'u'
]);

/**
 * Normaliza un nombre de producto: minúsculas, sin tildes, sin puntuación.
 */
export function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokens con contenido de un nombre de producto (sin stopwords).
 */
export function tokenizeProductName(name: string): string[] {
  return normalizeProductName(name)
    .split(' ')
    .filter(token => token.length > 0 && !STOPWORDS.has(token));
}

/**
 * Puntuación 0-1 de parecido entre el producto nuevo y un ejemplo.
 * Proporción de tokens del producto nuevo presentes en el ejemplo,
 * con bonificación si uno es prefijo del otro.
 */
export function scoreExampleSimilarity(targetTokens: string[], exampleTokens: string[]): number {
  if (targetTokens.length === 0 || exampleTokens.length === 0) {
    return 0;
  }
  const exampleSet = new Set(exampleTokens);
  const shared = targetTokens.filter(token => exampleSet.has(token));
  if (shared.length === 0) {
    return 0;
  }
  let score = shared.length / targetTokens.length;
  const targetJoined = targetTokens.join(' ');
  const exampleJoined = exampleTokens.join(' ');
  if (exampleJoined.startsWith(targetJoined) || targetJoined.startsWith(exampleJoined)) {
    score = Math.min(1, score + 0.2);
  }
  return score;
}

/**
 * Devuelve los mejores ejemplos del historial para un producto nuevo.
 * - Solo ejemplos con al menos un token en común.
 * - Ordenados por parecido (a igualdad, los más recientes primero).
 * - Diversos: como máximo `maxPerCategory` ejemplos por categoría.
 */
export function matchPastExamples(
  productName: string,
  history: PastCategorizedProduct[],
  maxExamples = 6,
  maxPerCategory = 2
): PastCategoryExample[] {
  const targetTokens = tokenizeProductName(productName);
  if (targetTokens.length === 0 || history.length === 0) {
    return [];
  }

  const scored = history
    .map(item => ({
      item,
      score: scoreExampleSimilarity(targetTokens, tokenizeProductName(item.productName))
    }))
    .filter(scoredItem => scoredItem.score > 0)
    .sort((a, b) =>
      b.score - a.score || b.item.updatedAt.getTime() - a.item.updatedAt.getTime()
    );

  const selected: PastCategoryExample[] = [];
  const perCategory = new Map<string, number>();
  for (const { item } of scored) {
    if (selected.length >= maxExamples) {
      break;
    }
    const count = perCategory.get(item.category) ?? 0;
    if (count >= maxPerCategory) {
      continue;
    }
    perCategory.set(item.category, count + 1);
    selected.push({ productName: item.productName, category: item.category });
  }

  return selected;
}
