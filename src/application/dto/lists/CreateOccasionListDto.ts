/**
 * DTO para crear listas inteligentes por ocasión usando IA
 * Basado en CU-32: Listas Inteligentes por Ocasión
 */
export interface CreateOccasionListDto {
  /**
   * Tipo de ocasión predefinida o personalizada
   * Ejemplos: "Barbacoa familiar", "Cena romántica", "Cumpleaños infantil", "Picnic", "Desayuno especial"
   */
  occasion: string;

  /**
   * Número de personas para la ocasión
   * Mínimo: 1, Máximo: 50
   */
  numberOfPeople: number;

  /**
   * Restricciones dietéticas opcionales
   * Ejemplos: ["vegetariano", "sin gluten", "diabético", "kosher", "halal"]
   */
  dietaryRestrictions?: string[];

  /**
   * Presupuesto máximo estimado en euros
   * Opcional - si no se especifica, no hay límite
   */
  maxBudget?: number;

  /**
   * Preferencias adicionales del usuario
   * Texto libre para especificar gustos o requerimientos especiales
   */
  additionalPreferences?: string;

  /**
   * ID de la tienda donde se realizará la compra
   * Opcional - si no se especifica, se usa tienda por defecto
   */
  storeId?: string;

  /**
   * Nombre personalizado para la lista generada
   * Si no se especifica, se genera automáticamente basado en la ocasión
   */
  customListName?: string;
}

/**
 * DTO de respuesta con la lista generada por IA
 */
export interface OccasionListResponseDto {
  /**
   * ID de la lista creada
   */
  listId: string;

  /**
   * Nombre de la lista generada
   */
  listName: string;

  /**
   * Descripción de la ocasión procesada
   */
  occasionDescription: string;

  /**
   * Productos generados por la IA
   */
  products: OccasionProductDto[];

  /**
   * Resumen de estimaciones
   */
  summary: {
    /**
     * Total de productos generados
     */
    totalProducts: number;

    /**
     * Costo estimado total (si hay precios)
     */
    estimatedCost?: number | undefined;

    /**
     * Categorías incluidas
     */
    categoriesIncluded: string[];

    /**
     * Restricciones aplicadas
     */
    restrictionsApplied: string[];
  };

  /**
   * Tiempo de procesamiento de la IA en milisegundos
   */
  processingTime: number;

  /**
   * Confianza de la IA en las sugerencias (0-100)
   */
  aiConfidence: number;
}

/**
 * Producto individual generado por IA para la ocasión
 */
export interface OccasionProductDto {
  /**
   * Nombre del producto sugerido
   */
  name: string;

  /**
   * Cantidad estimada necesaria
   */
  quantity: number;

  /**
   * Unidad de medida (kg, unidades, litros, etc.)
   */
  unit: string;

  /**
   * Categoría asignada
   */
  category: string;

  /**
   * Precio estimado por unidad (opcional)
   */
  estimatedPrice?: number | undefined;

  /**
   * Prioridad del producto (1=esencial, 2=importante, 3=opcional)
   */
  priority: 1 | 2 | 3;

  /**
   * Razón por la que la IA sugiere este producto
   */
  aiReason: string;

  /**
   * Alternativas sugeridas (opcional)
   */
  alternatives?: string[] | undefined;
}

/**
 * Validaciones para el DTO
 */
export const validateCreateOccasionListDto = (dto: CreateOccasionListDto): string[] => {
  const errors: string[] = [];

  // Validar ocasión
  if (!dto.occasion || dto.occasion.trim().length === 0) {
    errors.push('La ocasión es requerida y no puede estar vacía');
  }

  if (dto.occasion && dto.occasion.trim().length > 100) {
    errors.push('La ocasión no puede tener más de 100 caracteres');
  }

  // Validar número de personas
  if (!dto.numberOfPeople || dto.numberOfPeople < 1) {
    errors.push('El número de personas debe ser al menos 1');
  }

  if (dto.numberOfPeople && dto.numberOfPeople > 50) {
    errors.push('El número de personas no puede ser mayor a 50');
  }

  // Validar presupuesto
  if (dto.maxBudget !== undefined && dto.maxBudget < 0) {
    errors.push('El presupuesto no puede ser negativo');
  }

  if (dto.maxBudget !== undefined && dto.maxBudget > 10000) {
    errors.push('El presupuesto no puede ser mayor a 10,000 euros');
  }

  // Validar restricciones dietéticas
  if (dto.dietaryRestrictions && dto.dietaryRestrictions.length > 10) {
    errors.push('No se pueden especificar más de 10 restricciones dietéticas');
  }

  // Validar preferencias adicionales
  if (dto.additionalPreferences && dto.additionalPreferences.length > 500) {
    errors.push('Las preferencias adicionales no pueden tener más de 500 caracteres');
  }

  // Validar nombre personalizado
  if (dto.customListName && dto.customListName.trim().length > 50) {
    errors.push('El nombre personalizado no puede tener más de 50 caracteres');
  }

  return errors;
};

/**
 * Ocasiones predefinidas populares
 */
export const PREDEFINED_OCCASIONS = [
  'Barbacoa familiar',
  'Cena romántica',
  'Cumpleaños infantil',
  'Cumpleaños adulto',
  'Picnic en el parque',
  'Desayuno especial',
  'Brunch dominical',
  'Cena de Navidad',
  'Nochevieja',
  'Cena de amigos',
  'Almuerzo de trabajo',
  'Merienda infantil',
  'Cena mediterránea',
  'Comida mexicana',
  'Sushi casero',
  'Pizza casera',
  'Paella familiar',
  'Tapas españolas',
  'Desayuno continental',
  'Cena vegetariana'
] as const;

export type PredefinedOccasion = typeof PREDEFINED_OCCASIONS[number];