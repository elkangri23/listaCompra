# CU-29: Categorización Masiva Inteligente con IA

## 📋 Descripción General
Permite categorizar automáticamente múltiples productos en lote utilizando IA (Perplexity Llama 3.1 Sonar), optimizando costos mediante batching inteligente, cache Redis y rate limiting.

---

## 🎯 Objetivos
1. **Reducir costos de IA**: Procesar múltiples productos en un solo request API
2. **Optimizar tiempo de respuesta**: Batching inteligente con límites configurables
3. **Calidad consistente**: Scoring de confianza para cada categorización
4. **Resiliencia**: Manejo de fallos parciales sin afectar todo el batch
5. **Cache inteligente**: Reutilizar categorizaciones previas (TTL 24h)

---

## 📐 Arquitectura

### Flujo de Datos
```
Cliente HTTP
   ↓
AIController (POST /api/v1/ai/bulk-categorize)
   ↓
[authMiddleware, rateLimitMiddleware (5 req/hora)]
   ↓
BulkCategorizeProducts Use Case
   ↓
CachedAIService → Redis (TTL 24h)
   ↓ (cache miss)
PerplexityService → Perplexity API (batching optimizado)
   ↓
Enriquecimiento con BD (tiendas, categorías existentes)
   ↓
Response JSON con confidence scoring
```

---

## 🔑 Endpoints

### **POST** `/api/v1/ai/bulk-categorize`

#### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

#### Request Body
```json
{
  "products": [
    {
      "nombre": "Leche entera Pascual 1L",
      "descripcion": "Leche entera pasteurizada, botella 1 litro"
    },
    {
      "nombre": "Pan integral",
      "descripcion": null
    },
    {
      "nombre": "Coca Cola 2L"
    }
  ],
  "tiendaId": "uuid-optional",
  "enrichWithExistingCategories": true
}
```

#### Validaciones
- **products**: Array de 1-50 productos (requerido)
- **products[].nombre**: String 1-100 caracteres (requerido)
- **products[].descripcion**: String opcional, max 500 caracteres
- **tiendaId**: UUID válido (opcional)
- **enrichWithExistingCategories**: Boolean, default `true`

#### Response Success (200)
```json
{
  "success": true,
  "data": {
    "categorizedProducts": [
      {
        "nombre": "Leche entera Pascual 1L",
        "suggestedCategory": {
          "nombre": "Lácteos",
          "tiendaId": "uuid-tienda-default",
          "confidence": 95
        },
        "alternativeCategories": [
          { "nombre": "Bebidas", "confidence": 60 }
        ],
        "source": "ai", // "ai" | "cache" | "existing"
        "processingTimeMs": 1250
      },
      {
        "nombre": "Pan integral",
        "suggestedCategory": {
          "nombre": "Panadería",
          "tiendaId": "uuid-tienda-default",
          "confidence": 90
        },
        "alternativeCategories": [],
        "source": "cache",
        "processingTimeMs": 5
      }
    ],
    "batchStats": {
      "totalProducts": 3,
      "successful": 3,
      "failed": 0,
      "fromCache": 1,
      "fromAI": 2,
      "fromExisting": 0,
      "averageConfidence": 88.33,
      "totalProcessingTimeMs": 2505,
      "estimatedTokens": 450
    }
  }
}
```

#### Response Partial Failure (207)
```json
{
  "success": true,
  "data": {
    "categorizedProducts": [
      {
        "nombre": "Leche entera Pascual 1L",
        "suggestedCategory": { ... },
        "source": "ai",
        "processingTimeMs": 1250
      },
      {
        "nombre": "Producto inválido $$$",
        "error": "Invalid product name format",
        "source": "error",
        "processingTimeMs": 0
      }
    ],
    "batchStats": {
      "totalProducts": 2,
      "successful": 1,
      "failed": 1,
      "warnings": ["1 product(s) failed validation"]
    }
  }
}
```

#### Response Error (400/401/429/500)
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Bulk categorization rate limit: 5 requests per hour",
    "details": {
      "retryAfterSeconds": 1800
    }
  }
}
```

---

## 💻 Implementación Técnica

### 1. DTO (`src/application/dto/ai/BulkCategorizeProductsDto.ts`)
```typescript
export interface ProductInput {
  nombre: string;
  descripcion?: string;
}

export interface BulkCategorizeProductsDto {
  products: ProductInput[];
  tiendaId?: string;
  enrichWithExistingCategories?: boolean;
}

export interface CategorizedProduct {
  nombre: string;
  suggestedCategory?: {
    nombre: string;
    tiendaId: string;
    confidence: number;
  };
  alternativeCategories: Array<{
    nombre: string;
    confidence: number;
  }>;
  source: 'ai' | 'cache' | 'existing' | 'error';
  error?: string;
  processingTimeMs: number;
}

export interface BulkCategorizationResult {
  categorizedProducts: CategorizedProduct[];
  batchStats: {
    totalProducts: number;
    successful: number;
    failed: number;
    fromCache: number;
    fromAI: number;
    fromExisting: number;
    averageConfidence: number;
    totalProcessingTimeMs: number;
    estimatedTokens: number;
    warnings?: string[];
  };
}
```

### 2. Use Case (`src/application/use-cases/ai/BulkCategorizeProducts.ts`)

#### Responsabilidades
1. Validar input (max 50 productos)
2. Verificar permisos de usuario
3. Enriquecer con categorías existentes de BD (si `enrichWithExistingCategories=true`)
4. Dividir en sub-batches si >20 productos
5. Llamar a `CachedAIService.bulkCategorizeProducts()`
6. Calcular scoring de confianza
7. Agregar estadísticas del batch
8. Retornar Result con datos completos

#### Pseudocódigo
```typescript
class BulkCategorizeProducts {
  async execute(dto: BulkCategorizeProductsDto, userId: string): Promise<Result<BulkCategorizationResult>> {
    // 1. Validaciones
    if (dto.products.length > 50) return failure("Max 50 products per batch");
    if (dto.products.length === 0) return failure("At least 1 product required");
    
    // 2. Verificar usuario existe
    const userResult = await this.usuarioRepo.findById(userId);
    if (userResult.isFailure) return failure("User not found");
    
    // 3. Obtener categorías existentes de BD (si tiendaId provisto)
    let existingCategories: Categoria[] = [];
    if (dto.enrichWithExistingCategories && dto.tiendaId) {
      const categoriesResult = await this.categoriaRepo.findByTienda(dto.tiendaId);
      if (categoriesResult.isSuccess) {
        existingCategories = categoriesResult.value;
      }
    }
    
    // 4. Dividir en sub-batches de 20 productos (optimización de tokens)
    const subBatches = this.splitIntoSubBatches(dto.products, 20);
    const allResults: CategorizedProduct[] = [];
    let totalTokens = 0;
    
    // 5. Procesar cada sub-batch
    for (const batch of subBatches) {
      const startTime = Date.now();
      
      // Llamar a AI service (con cache automático)
      const aiResult = await this.aiService.bulkCategorizeProducts(
        batch,
        existingCategories.map(c => c.nombre)
      );
      
      if (aiResult.isSuccess) {
        const categorized = aiResult.value;
        allResults.push(...categorized.map(product => ({
          ...product,
          processingTimeMs: Date.now() - startTime
        })));
        totalTokens += categorized.estimatedTokens || 0;
      } else {
        // Partial failure: marcar productos del batch como error
        allResults.push(...batch.map(p => ({
          nombre: p.nombre,
          alternativeCategories: [],
          source: 'error' as const,
          error: aiResult.error.message,
          processingTimeMs: Date.now() - startTime
        })));
      }
    }
    
    // 6. Calcular estadísticas del batch
    const stats = this.calculateBatchStats(allResults, totalTokens);
    
    // 7. Retornar resultado
    return success({
      categorizedProducts: allResults,
      batchStats: stats
    });
  }
  
  private calculateBatchStats(products: CategorizedProduct[], tokens: number) {
    const successful = products.filter(p => p.source !== 'error').length;
    const failed = products.length - successful;
    const fromCache = products.filter(p => p.source === 'cache').length;
    const fromAI = products.filter(p => p.source === 'ai').length;
    const fromExisting = products.filter(p => p.source === 'existing').length;
    
    const confidences = products
      .filter(p => p.suggestedCategory)
      .map(p => p.suggestedCategory!.confidence);
    
    const averageConfidence = confidences.length > 0
      ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
      : 0;
    
    const totalProcessingTimeMs = products.reduce((sum, p) => sum + p.processingTimeMs, 0);
    
    return {
      totalProducts: products.length,
      successful,
      failed,
      fromCache,
      fromAI,
      fromExisting,
      averageConfidence: Math.round(averageConfidence * 100) / 100,
      totalProcessingTimeMs,
      estimatedTokens: tokens,
      warnings: failed > 0 ? [`${failed} product(s) failed categorization`] : undefined
    };
  }
}
```

### 3. PerplexityService Extension

#### Nuevo Método
```typescript
async bulkCategorizeProducts(
  products: ProductInput[],
  existingCategories?: string[]
): Promise<Result<{
  categorizedProducts: CategorizedProduct[];
  estimatedTokens: number;
}>>
```

#### Prompt Engineering Optimizado
```typescript
const systemPrompt = `Eres un asistente experto en categorización de productos de supermercado.
Analiza el siguiente lote de productos y asigna categorías apropiadas.

CATEGORÍAS EXISTENTES EN LA TIENDA:
${existingCategories.join(', ') || 'Ninguna (usar categorías genéricas)'}

REGLAS:
1. Prioriza categorías existentes cuando apliquen
2. Usa nombres simples y claros (máx 30 caracteres)
3. Asigna confidence 0-100 basado en certeza
4. Proporciona 1-3 categorías alternativas si hay ambigüedad
5. Categorías genéricas comunes: Lácteos, Bebidas, Panadería, Carne, Frutas, Verduras, Limpieza, Higiene, Snacks, Congelados

FORMATO DE RESPUESTA (JSON estricto):
{
  "products": [
    {
      "nombre": "Nombre del producto original",
      "suggestedCategory": {
        "nombre": "Categoría principal",
        "confidence": 95
      },
      "alternativeCategories": [
        { "nombre": "Alternativa 1", "confidence": 70 }
      ]
    }
  ]
}`;

const userPrompt = `Categoriza estos ${products.length} productos:

${products.map((p, i) => `${i + 1}. ${p.nombre}${p.descripcion ? ` - ${p.descripcion}` : ''}`).join('\n')}`;
```

### 4. Cache Strategy (Redis)

#### Key Format
```
ai:bulk-categorize:<hash_of_product_names>
```

#### TTL
24 horas (86400 segundos)

#### Implementación en CachedAIService
```typescript
async bulkCategorizeProducts(
  products: ProductInput[],
  existingCategories?: string[]
): Promise<Result<any>> {
  // 1. Generar cache key (hash de nombres de productos)
  const productNames = products.map(p => p.nombre).sort().join('|');
  const cacheKey = `ai:bulk-categorize:${this.hashString(productNames)}`;
  
  // 2. Intentar leer de cache
  const cached = await this.redisClient.get(cacheKey);
  if (cached) {
    const parsed = JSON.parse(cached);
    // Marcar todos como "cache" source
    return success({
      ...parsed,
      categorizedProducts: parsed.categorizedProducts.map(p => ({
        ...p,
        source: 'cache'
      }))
    });
  }
  
  // 3. Cache miss: llamar a PerplexityService
  const result = await this.perplexityService.bulkCategorizeProducts(products, existingCategories);
  
  // 4. Guardar en cache si exitoso
  if (result.isSuccess) {
    await this.redisClient.setex(cacheKey, 86400, JSON.stringify(result.value));
  }
  
  return result;
}
```

### 5. Rate Limiting

#### Middleware Específico
```typescript
// src/infrastructure/http/middlewares/aiRateLimitMiddleware.ts
export const bulkCategorizationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // 5 requests por hora
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Bulk categorization rate limit: 5 requests per hour',
      details: {
        retryAfterSeconds: 3600
      }
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip // Por usuario o IP
});
```

---

## 🧪 Testing

### Tests Unitarios (`BulkCategorizeProducts.test.ts`)

#### Casos de Prueba (15-20 tests)
1. ✅ **Validación de límites**:
   - Rechazar >50 productos
   - Rechazar array vacío
   - Rechazar productos con nombres inválidos

2. ✅ **Batching logic**:
   - 10 productos → 1 sub-batch
   - 30 productos → 2 sub-batches (20+10)
   - 50 productos → 3 sub-batches (20+20+10)

3. ✅ **Integración con AI service**:
   - Mock PerplexityService exitoso
   - Mock fallos parciales (algunos productos fallan)
   - Mock timeout de IA

4. ✅ **Cache behavior**:
   - Verificar llamada a CachedAIService
   - No llamar a Perplexity si todos en cache

5. ✅ **Enriquecimiento con BD**:
   - `enrichWithExistingCategories=true` → buscar categorías
   - `enrichWithExistingCategories=false` → skip BD
   - `tiendaId` provisto → filtrar por tienda

6. ✅ **Estadísticas de batch**:
   - Calcular `averageConfidence` correctamente
   - Contabilizar fuentes (cache/ai/existing/error)
   - Sumar tiempos de procesamiento

7. ✅ **Manejo de errores**:
   - Usuario no existe → failure
   - AI service falla completamente → partial results
   - Categoría repo falla → continuar sin enriquecimiento

---

## 📊 Métricas y Monitoreo

### Logs Recomendados
```typescript
this.logger.info('Bulk categorization started', {
  userId,
  productCount: dto.products.length,
  tiendaId: dto.tiendaId,
  enrichWithExisting: dto.enrichWithExistingCategories
});

this.logger.info('Bulk categorization completed', {
  successful: stats.successful,
  failed: stats.failed,
  fromCache: stats.fromCache,
  fromAI: stats.fromAI,
  averageConfidence: stats.averageConfidence,
  totalTimeMs: stats.totalProcessingTimeMs,
  estimatedTokens: stats.estimatedTokens
});
```

### Alertas
- **Rate limit exceeded**: >10 usuarios alcanzando límite en 1 hora
- **AI failures**: >20% de productos fallando en batch
- **Low confidence**: Average confidence <60% en batch
- **High latency**: Batches tomando >10 segundos

---

## 🚀 Optimizaciones Futuras

1. **Auto-batching adaptativo**: Ajustar tamaño de sub-batch según latencia
2. **Aprendizaje de patrones**: Sugerir categorías basadas en historial del usuario
3. **Pre-categorización**: Background job para productos populares
4. **Bulk update**: Aplicar categorizaciones masivamente a productos existentes
5. **Webhooks**: Notificar cuando batch largo termine

---

## 📝 Checklist de Implementación

- [ ] Crear `BulkCategorizeProductsDto.ts` con validaciones Zod
- [ ] Implementar `BulkCategorizeProducts.ts` use case
- [ ] Extender `PerplexityService` con `bulkCategorizeProducts()`
- [ ] Actualizar `IAIService` interface
- [ ] Implementar cache en `CachedAIService`
- [ ] Añadir endpoint en `AIController`
- [ ] Crear `aiRateLimitMiddleware.ts`
- [ ] Documentar en `aiRoutes.ts` con Swagger
- [ ] Escribir 15-20 tests en `BulkCategorizeProducts.test.ts`
- [ ] Integrar en `container.ts`
- [ ] Actualizar `README.md` y `ESTADO_PROYECTO.md`
- [ ] Testing manual con Postman/Thunder Client

---

## 🎯 Criterios de Aceptación

1. ✅ Endpoint `/api/v1/ai/bulk-categorize` funcional
2. ✅ Procesa 1-50 productos por request
3. ✅ Rate limiting de 5 req/hora funciona
4. ✅ Cache Redis reduce >70% llamadas a Perplexity
5. ✅ Confidence scoring promedio >85%
6. ✅ Manejo robusto de fallos parciales
7. ✅ Tests unitarios >90% coverage
8. ✅ Documentación Swagger completa
9. ✅ Logs estructurados para todas las operaciones
10. ✅ TypeScript 0 errores de compilación

---

**Estimación de tiempo**: 4-6 horas

**Prioridad**: Alta (funcionalidad premium diferenciadora)

**Dependencias**: CU-28 (IA básica), Redis configurado, Perplexity API key válida
