/**
 * Caso de Uso: CreateOccasionList (CU-32)
 * Generación de listas inteligentes por ocasión usando IA
 */

import { Result, success, failure } from '../../../shared/result';
import { IAIService } from '../../ports/external/IAIService';
import { IListaRepository } from '../../ports/repositories/IListaRepository';
import { IProductoRepository } from '../../ports/repositories/IProductoRepository';
import { ITiendaRepository } from '../../ports/repositories/ITiendaRepository';
import { ICategoriaRepository } from '../../ports/repositories/ICategoriaRepository';
import { Lista } from '../../../domain/entities/Lista';
import { Producto } from '../../../domain/entities/Producto';
import { CreateOccasionListDto, OccasionListResponseDto, validateCreateOccasionListDto } from '../../dto/lists/CreateOccasionListDto';
import { Logger } from '../../../infrastructure/observability/logger/Logger';
import { ValidationError } from '../../errors/ValidationError';
import { NotFoundError } from '../../errors/NotFoundError';
import { v4 as uuidv4 } from 'uuid';

interface CreateOccasionListUseCaseDeps {
  aiService: IAIService;
  listaRepository: IListaRepository;
  productoRepository: IProductoRepository;
  tiendaRepository: ITiendaRepository;
  categoriaRepository: ICategoriaRepository;
}

interface AIGeneratedProduct {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  estimatedPrice?: number;
  priority: 1 | 2 | 3;
  reason: string;
  alternatives?: string[];
}

export class CreateOccasionListUseCase {
  private readonly logger = new Logger('CreateOccasionListUseCase');

  constructor(private readonly deps: CreateOccasionListUseCaseDeps) {}

  async execute(dto: CreateOccasionListDto, userId: string): Promise<Result<OccasionListResponseDto>> {
    const startTime = Date.now();
    const requestId = uuidv4();

    try {
      // 1. Validar entrada
      const validationErrors = validateCreateOccasionListDto(dto);
      if (validationErrors.length > 0) {
        return failure(new ValidationError(`Datos inválidos: ${validationErrors.join(', ')}`, 'occasion_list', dto));
      }

      this.logger.ai(`Iniciando generación de lista por ocasión: ${dto.occasion}`, {
        requestId,
        userId,
        numberOfPeople: dto.numberOfPeople,
        budget: dto.maxBudget,
        restrictions: dto.dietaryRestrictions
      });

      // 2. Validar tienda si se especifica
      let storeId = dto.storeId;
      if (storeId) {
        const storeResult = await this.deps.tiendaRepository.findById(storeId);
        if (storeResult.isFailure || !storeResult.value) {
          return failure(new NotFoundError('Tienda', storeId));
        }
      } else {
        // Usar tienda por defecto
        const defaultStoresResult = await this.deps.tiendaRepository.findAll();
        if (defaultStoresResult.isSuccess && defaultStoresResult.value.length > 0) {
          storeId = defaultStoresResult.value[0]?.id;
        }
      }

      // 3. Obtener categorías existentes para contexto
      const existingCategoriesResult = await this.deps.categoriaRepository.findByTienda(storeId || null);
      const categoryNames = existingCategoriesResult.isSuccess 
        ? existingCategoriesResult.value.map((cat: any) => cat.nombre)
        : [];

      // 4. Generar prompt para IA
      const aiPrompt = this.buildAIPrompt(dto, categoryNames);

      // 5. Solicitar generación a IA
      this.logger.ai('Solicitando generación de lista a IA', { requestId, promptLength: aiPrompt.length });
      
      const aiResponse = await this.deps.aiService.generateOccasionList(aiPrompt);
      const generatedProducts = this.parseAIResponse(aiResponse);

      // 6. Crear la lista
      const listName = dto.customListName || `${dto.occasion} (${dto.numberOfPeople} personas)`;
      const listaResult = Lista.create({
        nombre: listName,
        descripcion: `Lista generada automáticamente para: ${dto.occasion}. ${dto.numberOfPeople} personas.`,
        ...(storeId && { tiendaId: storeId }),
        propietarioId: userId
      });

      if (listaResult.isFailure) {
        return failure(listaResult.error);
      }

      const savedListResult = await this.deps.listaRepository.save(listaResult.value);
      if (savedListResult.isFailure) {
        return failure(savedListResult.error);
      }

      const savedList = savedListResult.value;

      // 7. Crear productos en la lista
      const savedProducts: Producto[] = [];
      let totalEstimatedCost = 0;
      const categoriesUsed = new Set<string>();

      for (const aiProduct of generatedProducts) {
        const productoResult = Producto.create({
          nombre: aiProduct.name,
          cantidad: aiProduct.quantity,
          unidad: aiProduct.unit,
          precio: aiProduct.estimatedPrice || null,
          comprado: false,
          listaId: savedList.id,
          creadoPorId: userId
        });

        if (productoResult.isFailure) {
          continue; // Skip productos con errores
        }

        const savedProductResult = await this.deps.productoRepository.save(productoResult.value);
        if (savedProductResult.isSuccess) {
          savedProducts.push(savedProductResult.value);

          if (aiProduct.estimatedPrice) {
            totalEstimatedCost += aiProduct.estimatedPrice * aiProduct.quantity;
          }
          categoriesUsed.add(aiProduct.category);
        }
      }

      // 8. Construir respuesta
      const processingTime = Date.now() - startTime;
      const response: OccasionListResponseDto = {
        listId: savedList.id,
        listName: savedList.nombre,
        occasionDescription: `Lista para ${dto.occasion} con ${dto.numberOfPeople} personas`,
        products: generatedProducts.map(p => ({
          name: p.name,
          quantity: p.quantity,
          unit: p.unit,
          category: p.category,
          estimatedPrice: p.estimatedPrice || undefined,
          priority: p.priority,
          aiReason: p.reason,
          alternatives: p.alternatives || undefined
        })),
        summary: {
          totalProducts: generatedProducts.length,
          estimatedCost: totalEstimatedCost > 0 ? totalEstimatedCost : undefined,
          categoriesIncluded: Array.from(categoriesUsed),
          restrictionsApplied: dto.dietaryRestrictions || []
        },
        processingTime,
        aiConfidence: this.calculateAIConfidence(generatedProducts)
      };

      this.logger.ai('Lista por ocasión generada exitosamente', {
        requestId,
        listId: savedList.id,
        totalProducts: generatedProducts.length,
        processingTime,
        aiConfidence: response.aiConfidence
      });

      return success(response);

    } catch (error) {
      this.logger.error('Error generando lista por ocasión', error, { requestId, userId });
      return failure(new Error(`Error interno al generar lista: ${error instanceof Error ? error.message : 'Error desconocido'}`));
    }
  }

  /**
   * Construye el prompt optimizado para la IA
   */
  private buildAIPrompt(dto: CreateOccasionListDto, existingCategories: string[]): string {
    let prompt = `Genera una lista de compras completa para la siguiente ocasión:

OCASIÓN: ${dto.occasion}
PERSONAS: ${dto.numberOfPeople}`;

    if (dto.maxBudget) {
      prompt += `\nPRESUPUESTO: Máximo ${dto.maxBudget}€`;
    }

    if (dto.dietaryRestrictions && dto.dietaryRestrictions.length > 0) {
      prompt += `\nRESTRICCIONES: ${dto.dietaryRestrictions.join(', ')}`;
    }

    if (dto.additionalPreferences) {
      prompt += `\nPREFERENCIAS: ${dto.additionalPreferences}`;
    }

    if (existingCategories.length > 0) {
      prompt += `\nCATEGORÍAS DISPONIBLES: ${existingCategories.join(', ')}`;
    }

    prompt += `

INSTRUCCIONES:
1. Genera una lista completa y realista de productos
2. Incluye cantidades exactas considerando ${dto.numberOfPeople} personas
3. Especifica unidades apropiadas (kg, unidades, litros, etc.)
4. Asigna categorías de las disponibles o crea nuevas si es necesario
5. Incluye precios estimados en euros si es relevante
6. Prioriza productos: 1=esencial, 2=importante, 3=opcional
7. Proporciona razón para cada producto
8. Sugiere alternativas cuando sea apropiado

FORMATO DE RESPUESTA (JSON):
{
  "products": [
    {
      "name": "Nombre del producto",
      "quantity": número,
      "unit": "unidad",
      "category": "categoría",
      "estimatedPrice": precio_opcional,
      "priority": 1|2|3,
      "reason": "Por qué se necesita este producto",
      "alternatives": ["alternativa1", "alternativa2"]
    }
  ]
}`;

    return prompt;
  }

  /**
   * Parsea la respuesta de la IA y extrae los productos
   */
  private parseAIResponse(aiResponse: string): AIGeneratedProduct[] {
    try {
      // Intentar extraer JSON de la respuesta
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No se encontró JSON válido en la respuesta de IA');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!parsed.products || !Array.isArray(parsed.products)) {
        throw new Error('Formato de respuesta IA inválido: falta array de productos');
      }

      return parsed.products.map((product: any) => ({
        name: product.name || 'Producto sin nombre',
        quantity: Math.max(1, parseInt(product.quantity) || 1),
        unit: product.unit || 'unidades',
        category: product.category || 'General',
        estimatedPrice: product.estimatedPrice ? parseFloat(product.estimatedPrice) : undefined,
        priority: [1, 2, 3].includes(product.priority) ? product.priority : 2,
        reason: product.reason || 'Sugerido por IA',
        alternatives: Array.isArray(product.alternatives) ? product.alternatives : undefined
      }));

    } catch (error) {
      this.logger.error('Error parseando respuesta de IA', error);
      
      // Fallback: generar productos básicos si falla el parsing
      return this.generateFallbackProducts(aiResponse);
    }
  }

  /**
   * Genera productos básicos si falla el parsing de IA
   */
  private generateFallbackProducts(aiResponse: string): AIGeneratedProduct[] {
    // Extraer productos mencionados en texto plano
    const lines = aiResponse.split('\n').filter(line => 
      line.trim().length > 0 && 
      (line.includes('-') || line.includes('•') || /^\d+\./.test(line.trim()))
    );

    const products: AIGeneratedProduct[] = [];
    
    for (const line of lines.slice(0, 10)) { // Máximo 10 productos
      const cleanLine = line.replace(/^[-•\d\.\s]+/, '').trim();
      if (cleanLine.length > 2) {
        products.push({
          name: cleanLine.substring(0, 50),
          quantity: 1,
          unit: 'unidades',
          category: 'General',
          priority: 2,
          reason: 'Extraído de respuesta IA'
        });
      }
    }

    return products.length > 0 ? products : [
      {
        name: 'Producto básico',
        quantity: 1,
        unit: 'unidades',
        category: 'General',
        priority: 1,
        reason: 'Producto por defecto debido a error en IA'
      }
    ];
  }

  /**
   * Calcula la confianza de la IA basada en la calidad de los productos generados
   */
  private calculateAIConfidence(products: AIGeneratedProduct[]): number {
    if (products.length === 0) return 0;

    let score = 0;
    let maxScore = 0;

    for (const product of products) {
      // Puntos por tener nombre descriptivo
      maxScore += 20;
      if (product.name.length > 5 && product.name.length < 50) {
        score += 20;
      }

      // Puntos por cantidad realista
      maxScore += 15;
      if (product.quantity > 0 && product.quantity <= 20) {
        score += 15;
      }

      // Puntos por tener unidad específica
      maxScore += 10;
      if (product.unit !== 'unidades') {
        score += 10;
      }

      // Puntos por tener categoría específica
      maxScore += 15;
      if (product.category !== 'General') {
        score += 15;
      }

      // Puntos por tener precio estimado
      maxScore += 10;
      if (product.estimatedPrice && product.estimatedPrice > 0) {
        score += 10;
      }

      // Puntos por tener razón descriptiva
      maxScore += 15;
      if (product.reason.length > 10) {
        score += 15;
      }

      // Puntos por tener alternativas
      maxScore += 15;
      if (product.alternatives && product.alternatives.length > 0) {
        score += 15;
      }
    }

    return Math.round((score / maxScore) * 100);
  }
}