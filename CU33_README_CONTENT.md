### 🤖 **CU-33: Recomendaciones Contextuales con IA (30 Oct 2025) - RECIÉN COMPLETADO** ✅
- 🎯 **3 Endpoints REST Funcionales**: Recomendaciones generales, específicas por producto, y ejemplos de contexto
- 🧠 **IA Avanzada**: Integración Perplexity con 3 niveles creatividad (conservative/balanced/creative)
- 📊 **Scoring inteligente**: Confidence 0-100 con razones explicativas para cada sugerencia
- 🔍 **Filtros granulares**: Por categoría, tienda, historial, productos existentes
- 🎨 **Context-aware**: Interpreta "Cena romántica", "Desayuno fitness", "Barbacoa familiar"
- 🛡️ **Fallbacks robustos**: 15 reglas basadas en patrones si IA no disponible
- 📈 **Enriquecimiento local**: Categorías desde BD, precios estimados, cantidades sugeridas
- 💾 **Backend completo**: Use case (368 líneas), Controller (330+), Rutas con Swagger (390+)
- ✅ **TypeScript**: 0 errores compilación, integración DI Container y server.ts
- 📦 **4 tipos de recomendación**: Complement, frequently_together, category_match, user_preference

---

## Sección Detallada CU-33 para insertar en Características Principales > IA

#### **CU-33: Recomendaciones Contextuales Automáticas** ✅ **NUEVO (30 Oct 2025)**
Genera sugerencias inteligentes de productos complementarios basándose en el contenido actual de las listas:

**📡 Endpoints REST:**
- `GET /api/v1/recommendations/:listId` - Recomendaciones generales para lista
- `GET /api/v1/recommendations/:listId/for-product/:productId` - Recomendaciones específicas de producto
- `GET /api/v1/recommendations/context-examples` - Ejemplos de contextos (público)

**🎯 Características:**
- **3 niveles de creatividad**: Conservative (productos muy relacionados), Balanced (mix equilibrado), Creative (sugerencias innovadoras)
- **Filtros avanzados**: Por categoría, tienda, historial de usuario
- **Scoring de confianza**: 0-100 para cada recomendación con razones explicativas
- **Context-aware**: Interpreta contextos como "Cena romántica", "Desayuno fitness", "Barbacoa"
- **Enriquecimiento local**: Categorías desde BD, precios estimados, cantidades sugeridas
- **Fallbacks robustos**: 15 reglas basadas en patrones si IA no disponible
- **Tipos de recomendación**: Complementarios, frecuentes juntos, misma categoría, preferencias

**💡 Ejemplos de uso:**
```bash
# Recomendaciones generales para una lista
GET /api/v1/recommendations/abc123?creativityLevel=balanced&maxRecommendations=10

# Recomendaciones específicas basadas en "Pasta"
GET /api/v1/recommendations/abc123/for-product/prod456?context=Cena%20italiana

# Filtrar solo productos de categoría "Vegetales"
GET /api/v1/recommendations/abc123?categoryId=cat789&excludeExisting=true
```

**🔧 Parámetros opcionales:**
- `maxRecommendations` (5-50, default: 10) - Cantidad de sugerencias
- `creativityLevel` (conservative/balanced/creative) - Nivel de innovación
- `categoryId` - Filtrar por categoría específica
- `storeId` - Filtrar por productos de tienda
- `context` - Contexto textual para mejorar sugerencias
- `includeUserHistory` (boolean) - Incluir historial de compras
- `excludeExisting` (boolean, default: true) - Excluir productos ya en lista

**📊 Respuesta típica:**
```json
{
  "success": true,
  "data": {
    "listId": "abc123",
    "recommendations": [
      {
        "name": "Salsa de tomate",
        "reason": "Complementa perfectamente con la pasta que agregaste",
        "confidenceScore": 92,
        "suggestedCategory": {"id": "cat456", "name": "Salsas"},
        "estimatedPrice": 2.5,
        "suggestedQuantity": 1,
        "suggestedUnit": "unidades",
        "relatedProducts": ["Pasta"],
        "tags": ["italiano", "básico"],
        "recommendationType": "complement"
      }
    ],
    "detectedContext": "Comida italiana casual",
    "productsInList": 5,
    "metadata": {
      "processingTime": 1250,
      "aiUsed": true,
      "averageConfidence": 87.3
    }
  }
}
```
