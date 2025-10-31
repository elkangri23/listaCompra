# 🚀 Colección Postman/Thunder Client - Lista de Compra API

Esta carpeta contiene colecciones completas para probar todos los endpoints de la API de Lista de Compra Colaborativa.

## 📁 Archivos Incluidos

- **`postman_collection.json`** - Colección completa con todos los endpoints
- **`postman_environment.json`** - Variables de entorno para desarrollo local
- **`API_Testing_Guide.md`** - Esta guía de uso

## 🛠️ Herramientas Compatibles

### ✅ Postman
1. Abre Postman
2. Clic en **Import** → **Upload Files**
3. Selecciona `postman_collection.json`
4. Importa también `postman_environment.json`
5. Selecciona el entorno "Lista Compra - Local Development"

### ✅ Thunder Client (VS Code)
1. Instala la extensión Thunder Client en VS Code
2. Abre Thunder Client
3. Clic en **Collections** → **Import** 
4. Selecciona `postman_collection.json`
5. Las variables se configuran automáticamente

### ✅ Insomnia
1. Abre Insomnia
2. Clic en **Application** → **Import**
3. Selecciona `postman_collection.json`
4. Configura manualmente las variables de entorno

## 🚀 Guía de Uso Rápido

### 1. **Iniciar el Servidor**
```bash
cd listaCompra
npm run dev
# Servidor corriendo en http://localhost:3000
```

### 2. **Flujo de Testing Recomendado**

#### Paso 1: Autenticación
```
01. Autenticación → Registrar Usuario
01. Autenticación → Login (guarda token automáticamente)
```

#### Paso 2: Configurar Tienda y Categorías
```
05. Tiendas → Crear Tienda (guarda storeId)
04. Categorías → Crear Categoría (guarda categoryId)
```

#### Paso 3: Gestión de Listas
```
02. Listas de Compra → Crear Lista (guarda listId)
02. Listas de Compra → Obtener Mis Listas
```

#### Paso 4: Agregar Productos
```
03. Productos → Agregar Producto a Lista (guarda productId)
03. Productos → Obtener Productos de Lista
03. Productos → Marcar Producto como Comprado
```

#### Paso 5: Compartir Lista
```
06. Invitaciones → Compartir Lista (guarda invitationHash)
06. Invitaciones → Acceder a Lista Compartida
```

### 3. **Variables Automáticas**

Las siguientes variables se guardan automáticamente al ejecutar ciertos endpoints:

| Variable | Se guarda en | Descripción |
|----------|--------------|-------------|
| `token` | Login exitoso | Token de autenticación JWT |
| `userId` | Login exitoso | ID del usuario autenticado |
| `listId` | Crear Lista | ID de la lista creada |
| `productId` | Agregar Producto | ID del producto creado |
| `categoryId` | Crear Categoría | ID de la categoría creada |
| `storeId` | Crear Tienda | ID de la tienda creada |
| `invitationHash` | Compartir Lista | Hash de la invitación |

## 📚 Endpoints Disponibles

### 🔐 Autenticación (5 endpoints)
- ✅ Registrar Usuario (`POST /auth/register`)
- ✅ Login + guardado de token (`POST /auth/login`)
- ✅ Refresh Token (`POST /auth/refresh`)
- ✅ Logout (`POST /auth/logout`)
- ✅ Perfil actual (`GET /auth/me`)

### 📝 Listas de Compra (5 endpoints)
- ✅ Crear Lista (`POST /lists`)
- ✅ Listar mis listas con paginación (`GET /lists`)
- ✅ Detalle de lista (`GET /lists/:id`)
- ✅ Actualizar lista (`PUT /lists/:id`)
- ✅ Eliminar lista (`DELETE /lists/:id`)

### 🛒 Productos (5 endpoints)
- ✅ Agregar Producto (`POST /lists/:listId/products`)
- ✅ Listar Productos con filtros (`GET /lists/:listId/products`)
- ✅ Actualizar Producto (`PUT /lists/:listId/products/:productId`)
- ✅ Marcar como comprado (`PATCH /lists/:listId/products/:productId/purchased`)
- ✅ Eliminar Producto (`DELETE /lists/:listId/products/:productId`)

### 🏷️ Categorías (6 endpoints)
- ✅ Crear Categoría (`POST /categories`)
- ✅ Obtener Categorías (filtros por tienda/estado) (`GET /categories`)
- ✅ Actualizar Categoría (`PUT /categories/:id`)
- ✅ Eliminar Categoría (`DELETE /categories/:id`)
- ✅ Toggle estado (`PATCH /categories/:id/toggle-status`)
- ✅ Mover a otra tienda (`PUT /categories/:id/move-to-store`)

### 🏪 Tiendas (7 endpoints)
- ✅ Crear Tienda (`POST /stores`)
- ✅ Listar Tiendas (`GET /stores`)
- ✅ Obtener Tienda (`GET /stores/:id`)
- ✅ Actualizar Tienda (`PUT /stores/:id`)
- ✅ Eliminar Tienda (`DELETE /stores/:id`)
- ✅ Cambiar estado (`PATCH /stores/:id/toggle-status`)
- ✅ Categorías asociadas (`GET /stores/:id/categories`)

### 📤 Invitaciones y Permisos (7 endpoints)
- ✅ Compartir Lista (`POST /invitations/:listId/share`)
- ✅ Acceder vía hash (`GET /invitations/:hash/access`)
- ✅ Listar invitaciones activas (`GET /invitations/:listId/list`)
- ✅ Listar permisos (`GET /invitations/:listId/permissions`)
- ✅ Cambiar permiso (`PUT /invitations/:listId/permissions/:targetUsuarioId`)
- ✅ Revocar permiso (`DELETE /invitations/:listId/permissions/:targetUsuarioId`)
- ✅ Cancelar invitación (`DELETE /invitations/:invitacionId`)

### 📋 Blueprints/Plantillas (8 endpoints)
- ✅ Crear Blueprint (`POST /blueprints`)
- ✅ Mis Blueprints (`GET /blueprints`)
- ✅ Blueprints Públicos (`GET /blueprints/publicos`)
- ✅ Buscador avanzado (`GET /blueprints/buscar`)
- ✅ Detalle (`GET /blueprints/:id`)
- ✅ Actualizar (`PUT /blueprints/:id`)
- ✅ Eliminar (`DELETE /blueprints/:id`)
- ✅ Crear lista desde blueprint (`POST /blueprints/:id/crear-lista`)

### 🤖 IA - Categorización (4 endpoints)
- ✅ Sugerencias unitarias (`POST /ai/category-suggestions`)
- ✅ Categorización masiva (CU-29) (`POST /ai/bulk-categorize`)
- ✅ Health check (`GET /ai/health`)
- ✅ Telemetría IA (solo admin) (`GET /ai/info`)

### 🎉 IA - Listas por Ocasión (3 endpoints)
- ✅ Ocasiones disponibles (`GET /occasion-lists/occasions`)
- ✅ Generar lista por ocasión (`POST /occasion-lists/generate`)
- ✅ Previsualizar sin guardar (`POST /occasion-lists/preview`)

### 🧠 IA - Recomendaciones (3 endpoints)
- ✅ Recomendaciones generales (`GET /recommendations/:listId`)
- ✅ Recomendaciones por producto (`GET /recommendations/:listId/for-product/:productId`)
- ✅ Ejemplos de contexto (`GET /recommendations/context-examples`)

### 👑 Administración (5 endpoints)
- ✅ Iniciar impersonación (`POST /admin/impersonate`)
- ✅ Finalizar impersonación (`DELETE /admin/impersonate`)
- ✅ Estado de impersonación (`GET /admin/impersonate/status`)
- ✅ Auditoría (beta) (`GET /admin/audit/impersonations`)
- ✅ Security Test Suite (`GET /admin/security/test`)

### 📊 Dashboard y Monitoreo (4 endpoints)
- ✅ Métricas (`GET /dashboard/metrics`)
- ✅ Salud (`GET /dashboard/health`)
- ✅ Alertas (`GET /dashboard/alerts`)
- ✅ Performance (`GET /dashboard/performance`)

### ♻️ Cache Analytics (5 endpoints)
- ✅ Métricas en tiempo real (`GET /analytics/cache/realtime`)
- ✅ Historial diario (`GET /analytics/cache/daily`)
- ✅ Reporte de optimización (`GET /analytics/cache/optimization`)
- ✅ Dataset para dashboards (`GET /analytics/cache/dashboard`)
- ✅ Health del cache (`GET /analytics/cache/health`)

### 🛡️ Cache Integrity (5 endpoints - Solo Admin)
- ✅ Escanear integridad (`GET /admin/cache/integrity/scan`)
- ✅ Validar clave (`POST /admin/cache/integrity/validate`)
- ✅ Limpieza (con soporte dryRun) (`DELETE /admin/cache/integrity/cleanup`)
- ✅ Estadísticas y health (`GET /admin/cache/integrity/stats`)
- ✅ Reparación selectiva (`POST /admin/cache/integrity/repair`)

### 🔧 Desarrollo (3 endpoints - entornos dev/test)
- ✅ Listar eventos (`GET /dev/events`)
- ✅ Limpiar eventos (`DELETE /dev/events`)
- ✅ Publicar evento de prueba (`POST /dev/events/test`)

**Total de Endpoints:** **57 endpoints** (12 dedicados a IA y observabilidad)

## 🎯 Ejemplos de Testing

### Crear un Flujo Completo
1. **Registro**: `POST /auth/register`
2. **Login**: `POST /auth/login` → Guarda token
3. **Crear Tienda**: `POST /stores` → Guarda storeId
4. **Crear Categoría**: `POST /categories` → Guarda categoryId
5. **Crear Lista**: `POST /lists` → Guarda listId
6. **Agregar Producto**: `POST /lists/{listId}/products`
7. **Compartir Lista**: `POST /invitations/{listId}/share`
8. **Acceder como Invitado**: `GET /invitations/access/{hash}`

### Probar Filtros
```
GET /lists/{listId}/products?comprado=false&urgente=true&busqueda=manzana
GET /stores?tipo=supermercado&activas=true&search=mercadona
GET /categories?tiendaId={storeId}&activas=true
```

### Probar Permisos
1. Crea lista con Usuario A
2. Comparte con Usuario B (solo lectura)
3. Intenta modificar con Usuario B → Debe fallar
4. Cambia permisos a lectura-escritura
5. Intenta modificar con Usuario B → Debe funcionar

### 🔒 **Testing de Seguridad y Cache** (NUEVO)

#### **Prerequisitos**
- Token de administrador activo
- Servidor corriendo en modo desarrollo

#### **Flujo de Testing:**
```
1. Autenticación → Login como Admin (guarda token)
2. Cache Analytics → Health (GET /analytics/cache/health)
3. Cache Analytics → Daily Metrics (GET /analytics/cache/daily)
4. Cache Integrity → Scan (GET /admin/cache/integrity/scan?pattern=*)
5. Cache Integrity → Stats (GET /admin/cache/integrity/stats)
6. Cache Integrity → Cleanup (DELETE /admin/cache/integrity/cleanup) - usar dryRun=true inicialmente
7. Cache Integrity → Repair (POST /admin/cache/integrity/repair) - opcional
```

#### **Verificaciones de Seguridad:**
- ✅ **Solo administradores** pueden acceder a endpoints de cache
- ✅ **Rate limiting** aplicado (10 requests/15min para admin)
- ✅ **Auditoría de acciones** todas las operaciones loggeadas
- ✅ **Validación de datos** checksums MD5, SHA256, SHA512
- ✅ **Sanitización de inputs** protección XSS/injection automática

#### **Respuestas Esperadas:**
```json
{
  "success": true,
  "integrity": {
    "total": 150,
    "valid": 150,
    "corrupted": 0,
    "byCorruptionLevel": {
      "NONE": 150,
      "MINOR": 0,
      "SEVERE": 0,
      "CRITICAL": 0
    },
    "byDataType": {
      "ai_suggestion": 80,
      "blueprint_metadata": 40,
      "user_session": 30
    }
  },
  "cache": {
    "totalKeys": 320,
    "memoryInfo": {
      "used_memory_human": "5.12M",
      "maxmemory_policy": "allkeys-lru"
    },
    "timestamp": "2025-10-31T19:40:12.123Z"
  },
  "health": {
    "status": "healthy",
    "corruptionRate": 0,
    "recommendation": "Cache estable. Mantener escaneos cada hora."
  }
}
```

## 🚨 Notas Importantes

### ✅ Colección Postman v2.0.0 - Resumen Rápido
**Carpetas incluidas:**
- ✅ 01. Autenticación (5)
- ✅ 02. Listas de Compra (5)
- ✅ 03. Productos (5)
- ✅ 04. Categorías (6)
- ✅ 05. Tiendas (7)
- ✅ 06. Invitaciones & Permisos (7)
- ✅ 07. Inteligencia Artificial (IA Core - 4)
- ✅ 08. IA - Listas por Ocasión (3)
- ✅ 09. IA - Recomendaciones Contextuales (3)
- ✅ 10. Blueprints/Plantillas (8)
- ✅ 11. 🛡️ Admin & Security (5)
- ✅ 12. ♻️ Cache Observability (Analytics 5 + Integrity 5)
- ✅ 13. Dashboard & Monitoring (4)
- ✅ 14. Dev Utilities (solo dev/test) (3)

**Total:** **57 endpoints** listos para ejecutar (incluye CU-28, CU-29, CU-32, CU-33 y observabilidad de cache).

> Swagger UI actualizado en `/api/docs` y colección sincronizada con los nuevos endpoints de cache.

### Autenticación
- Todos los endpoints (excepto registro, login y acceso a invitaciones) requieren token JWT
- El token se incluye automáticamente si usas la variable `{{token}}`
- Expira en 1 hora por defecto

### Estados HTTP
- **200**: OK - Operación exitosa
- **201**: Created - Recurso creado
- **400**: Bad Request - Error de validación
- **401**: Unauthorized - Token inválido/faltante
- **403**: Forbidden - Sin permisos
- **404**: Not Found - Recurso no encontrado
- **409**: Conflict - Recurso duplicado
- **500**: Internal Server Error

### Variables de Entorno
```json
{
  "baseUrl": "http://localhost:3000/api/v1",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "user-uuid-here",
  "listId": "list-uuid-here",
  "productId": "product-uuid-here",
  "categoryId": "category-uuid-here",
  "storeId": "store-uuid-here",
  "invitationHash": "secure-hash-here",
  "targetUserId": "collaborator-uuid-here",
  "invitationId": "invitation-uuid-here",
  "blueprintId": "blueprint-uuid-here",
  "adminSessionId": "impersonation-session-uuid"
}
```

#### Paso 5: Inteligencia Artificial (🤖 IA)
```
07. IA Core → Sugerencias de Categorías (producto individual)
07. IA Core → Categorización Masiva (hasta 50 productos)
07. IA Core → Health Check IA
07. IA Core → Telemetría IA (solo admin)
08. IA Ocasiones → Obtener Ocasiones Disponibles (20+ plantillas)
08. IA Ocasiones → Generar Lista por Ocasión (barbacoa, cena romántica, etc.)
08. IA Ocasiones → Preview Lista por Ocasión (sin guardar en DB)
09. IA Recomendaciones → Recomendaciones Generales / Por Producto
```

#### Paso 6: Blueprints/Plantillas (📋 Templates)
```
10. Blueprints → Crear Blueprint (desde lista existente)
10. Blueprints → Obtener Mis Blueprints
10. Blueprints → Obtener Blueprints Públicos / Buscar
10. Blueprints → Crear Lista desde Blueprint
10. Blueprints → Actualizar / Eliminar Blueprint
```

#### Paso 7: Funcionalidades Administrativas (⚠️ Solo Admins)
```
11. Admin & Security → Impersonar Usuario (por ID o email)
11. Admin & Security → Consultar Estado de Impersonación
11. Admin & Security → Auditoría de Impersonaciones (beta)
11. Admin & Security → Ejecutar Security Test Suite
11. Admin & Security → Finalizar Impersonación
```

#### Paso 8: Observabilidad de Caché (♻️ Opcional)
```
12.1 Cache Analytics → Métricas en tiempo real / diarias
12.1 Cache Analytics → Optimization Report
12.2 Cache Integrity → Scan (GET) y Stats (GET)
12.2 Cache Integrity → Cleanup (dryRun=true) y Repair
```

### Probar Permisos
1. Crea lista con Usuario A
2. Comparte con Usuario B (solo lectura)
3. Intenta modificar con Usuario B → Debe fallar
4. Cambia permisos a lectura-escritura
5. Intenta modificar con Usuario B → Debe funcionar

### Probar Listas Inteligentes por Ocasión (🎉 NUEVO - CU-32)
```json
// 1. Ver ocasiones disponibles
GET /occasion-lists/occasions
// Respuesta: 20 ocasiones predefinidas

// 2. Generar lista para barbacoa (8 personas, 150€)
POST /occasion-lists/generate
{
  "occasion": "Barbacoa",
  "numberOfPeople": 8,
  "budget": 150,
  "dietaryRestrictions": ["Sin gluten"]
}

// 3. Preview sin guardar
POST /occasion-lists/preview
{
  "occasion": "Cena romántica",
  "numberOfPeople": 2,
  "budget": 80
}
```

**Ocasiones disponibles:**
- Barbacoa, Cena romántica, Fiesta infantil
- Desayuno fitness, Cena navideña, Picnic
- Brunch dominical, Cena vegana, Noche de películas
- Aperitivo con amigos, Comida familiar, Cena de negocios
- Comida saludable semanal, Fiesta de cumpleaños
- Cena de San Valentín, Halloween, Domingo de fútbol
- Tarde de juegos de mesa, Cena de Acción de Gracias
- Comida de playa

### Probar Recomendaciones Contextuales (🎯 NUEVO - CU-33)
```bash
# 1. Obtener ejemplos de contexto (público, sin auth)
GET /api/v1/recommendations/context-examples
# Respuesta: Ejemplos de contextos útiles y tips

# 2. Recomendaciones generales para una lista
GET /api/v1/recommendations/{listId}?creativityLevel=balanced&maxRecommendations=10
# Headers: Authorization: Bearer {{accessToken}}

# 3. Recomendaciones con contexto específico
GET /api/v1/recommendations/{listId}?context=Cena%20italiana&excludeExisting=true
# Headers: Authorization: Bearer {{accessToken}}

# 4. Recomendaciones basadas en producto específico
GET /api/v1/recommendations/{listId}/for-product/{productId}
# Headers: Authorization: Bearer {{accessToken}}

# 5. Filtrar por categoría y tienda
GET /api/v1/recommendations/{listId}?categoryId={catId}&storeId={storeId}
# Headers: Authorization: Bearer {{accessToken}}
```

**Parámetros opcionales:**
- `maxRecommendations` (5-50, default: 10) - Cantidad de sugerencias
- `creativityLevel` (conservative/balanced/creative) - Nivel de innovación
- `categoryId` - Filtrar por categoría específica
- `storeId` - Filtrar por productos de tienda
- `context` - Contexto textual ("Cena romántica", "Desayuno fitness")
- `includeUserHistory` (boolean) - Incluir historial de compras
- `excludeExisting` (boolean, default: true) - Excluir productos ya en lista

**Niveles de creatividad:**
- **Conservative**: Solo productos muy relacionados, alta confiabilidad
- **Balanced**: Mix equilibrado (recomendado), buena relación creatividad/confianza
- **Creative**: Sugerencias innovadoras, mayor exploración

**Tipos de recomendación en respuesta:**
- `complement` - Producto complementario directo
- `frequently_together` - Productos comprados juntos frecuentemente
- `category_match` - Productos de la misma categoría/contexto
- `user_preference` - Basado en historial del usuario

**Ejemplo de respuesta:**
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


```
13. Admin → Impersonar Usuario
13. Admin → Consultar Auditoría (filtros: fecha, usuario)
13. Admin → Finalizar Impersonación
13. Admin → Health Check Admin
```

## 🔍 Troubleshooting

### Error 401 - Unauthorized
- Verifica que el token esté configurado en `{{token}}`
- Ejecuta Login de nuevo para obtener token fresco
- Revisa que el header Authorization esté presente

### Error 403 - Forbidden (Admin Endpoints)
- Confirma que el usuario tenga rol ADMIN
- Verifica que el middleware de roles esté funcionando
- Revisa los logs del servidor para debugging

### Error 429 - Too Many Requests (Rate Limiting)
- **Admin General**: Espera 15 minutos (máx 10 requests)
- **Admin Impersonación**: Espera 1 hora (máx 5 requests)
- **Admin Auditoría**: Espera 5 minutos (máx 20 requests)
- Verifica headers X-RateLimit-* para detalles

### Error 404 - Not Found
- Verifica que las variables (listId, productId, etc.) estén configuradas
- Confirma que el recurso existe ejecutando el GET correspondiente

### Error 500 - Internal Server Error
- Revisa los logs del servidor en la terminal
- Verifica que la base de datos esté corriendo
- Confirma que RabbitMQ esté disponible

### Variables No Se Guardan
- Verifica que estés usando el entorno correcto
- Revisa la pestaña "Tests" de los requests para ver los scripts
- Confirma que la respuesta sea exitosa (200/201)

---

## 🆕 Nuevo: Categorización Masiva con IA (CU-29)

### 📦 Descripción
Endpoint que permite categorizar hasta **50 productos simultáneamente** usando IA (Perplexity Llama 3.1 Sonar), optimizando costos mediante batching inteligente y cache Redis.

### 🎯 Endpoint
```
POST /api/v1/ai/bulk-categorize
```

### 📝 Request Body Ejemplo
```json
{
  "products": [
    {
      "nombre": "Leche entera Pascual 1L",
      "descripcion": "Leche pasteurizada botella 1 litro"
    },
    {
      "nombre": "Pan integral"
    },
    {
      "nombre": "Coca Cola 2L"
    },
    {
      "nombre": "Pechuga de pollo",
      "descripcion": "Pollo fresco de granja"
    },
    {
      "nombre": "Tomates cherry"
    }
  ],
  "tiendaId": "{{storeId}}",
  "enrichWithExistingCategories": true
}
```

### ✅ Respuesta Exitosa (200 OK)
```json
{
  "success": true,
  "data": {
    "categorizedProducts": [
      {
        "nombre": "Leche entera Pascual 1L",
        "suggestedCategory": {
          "nombre": "Lácteos",
          "tiendaId": "uuid-tienda",
          "confidence": 95
        },
        "alternativeCategories": [
          { "nombre": "Bebidas", "confidence": 60 }
        ],
        "source": "ai",
        "processingTimeMs": 1250
      }
    ],
    "batchStats": {
      "totalProducts": 5,
      "successful": 5,
      "failed": 0,
      "fromCache": 2,
      "fromAI": 3,
      "fromExisting": 0,
      "averageConfidence": 88.5,
      "totalProcessingTimeMs": 3200,
      "estimatedTokens": 450
    }
  }
}
```

### 🔑 Características Clave
- **📦 Batching Inteligente**: División automática en sub-lotes de 20 productos
- **💾 Cache Redis**: TTL 24h para reducir costos de API
- **📊 Enriquecimiento BD**: Usa categorías existentes de la tienda
- **🛡️ Validación 3 Niveles**: DTO Zod + Use Case + Service Layer
- **📈 Estadísticas Completas**: Confidence, sources, timing detallados
- **⚠️ Fallos Parciales**: Código 207 si algunos productos fallan
- **🔐 Rate Limiting**: 5 requests/hora por usuario

### 🎯 Casos de Uso
1. **Onboarding de usuarios**: Categorizar productos masivamente al crear cuenta
2. **Importación de listas**: Categorizar productos importados de otras apps
3. **Optimización de BD**: Re-categorizar productos existentes con baja confianza
4. **Testing IA**: Validar calidad de categorización en lote

### ⚠️ Validaciones
- **Mínimo**: 1 producto
- **Máximo**: 50 productos por batch
- **Nombre producto**: 1-100 caracteres (requerido)
- **Descripción**: 0-500 caracteres (opcional)
- **tiendaId**: UUID válido (opcional)

### 📊 Códigos de Respuesta
- `200 OK`: Todos categorizados exitosamente
- `207 Multi-Status`: Algunos productos fallaron (ver `batchStats.failed`)
- `400 Bad Request`: Validación fallida (>50 productos, nombres inválidos)
- `401 Unauthorized`: Token JWT faltante o inválido
- `429 Too Many Requests`: Rate limit excedido (5 req/hora)
- `500 Internal Server Error`: Error del servidor

### 💡 Tips de Uso
- Usa `tiendaId` para mejor precisión con categorías existentes
- Activa `enrichWithExistingCategories: true` para priorizar categorías de BD
- Monitorea `batchStats.averageConfidence` (ideal >85%)
- Cache Redis evita llamadas duplicadas (ahorro de costos)
- Revisa `warnings` en respuesta para optimizaciones

---

## 🛡️ 11. Admin & Security

### Security Test - Vulnerability Scan

**Endpoint**: `GET /admin/security/test`
**Autenticación**: Bearer Token (Rol Admin requerido)

### 🔍 Descripción
Ejecuta una suite completa de tests de seguridad automáticos para validar la postura de seguridad de la aplicación.

### 📊 Response Format
```json
{
  "success": true,
  "securityScore": 95,
  "totalTests": 24,
  "passedTests": 23,
  "failedTests": 1,
  "summary": {
    "critical": 0,
    "high": 1,
    "medium": 0,
    "low": 23
  },
  "report": "🔐 === SECURITY SCAN REPORT ===\n📊 Overall Security Score: 95/100\n✅ GOOD: Security posture is good with minor improvements needed.",
  "results": [
    {
      "testName": "HTTPS Enforcement",
      "passed": false,
      "details": "HTTPS not enforced (development environment)",
      "severity": "MEDIUM",
      "recommendation": "Enable HTTPS for production deployment"
    }
  ],
  "timestamp": "2025-10-30T23:45:00.000Z"
}
```

### 🧪 Tests Incluidos
1. **XSS Protection** (6 vectores): Script injection, JavaScript URLs, event handlers
2. **SQL Injection Protection** (7 vectores): Union attacks, DROP commands, OR conditions
3. **Rate Limiting**: Validación de configuración Redis
4. **Security Headers**: X-Frame-Options, HSTS, CSP, X-XSS-Protection
5. **HTTPS Configuration**: SSL enforcement, certificados
6. **Authentication Security**: JWT tokens, password hashing
7. **Database Security**: SSL connections, credential exposure

### 🎯 Interpretación del Score
- **90-100**: 🏆 EXCELLENT - Listo para producción
- **80-89**: ✅ GOOD - Mejoras menores necesarias
- **70-79**: ⚠️ MODERATE - Mejoras requeridas antes de producción
- **<70**: 🚨 POOR - Issues críticos de seguridad

### 🔑 Características Clave
- **⚡ Ejecución Rápida**: ~2-3 segundos para suite completa
- **📊 Scoring Inteligente**: Algoritmo weighted por severidad
- **🎯 Solo Fallos**: Response muestra solo tests que fallaron
- **📋 Recomendaciones**: Acciones específicas para cada fallo
- **🔐 Admin Only**: Requiere rol de administrador

### ⚠️ Validaciones
- **Autenticación**: JWT Bearer token válido
- **Autorización**: Rol 'admin' requerido
- **Rate Limiting**: Aplicado por `adminRateLimitMiddleware`

### 📊 Códigos de Respuesta
- `200 OK`: Tests ejecutados exitosamente (independiente del score)
- `401 Unauthorized`: Token JWT faltante o inválido
- `403 Forbidden`: Usuario sin rol de administrador
- `429 Too Many Requests`: Rate limit administrativo excedido
- `500 Internal Server Error`: Error en la ejecución de tests

### 💡 Tips de Uso
- Ejecuta antes de deployments a producción
- Monitorea el score regularmente (objetivo >90%)
- Usa las recomendaciones para priorizar mejoras de seguridad
- Los tests en desarrollo pueden fallar por configuraciones locales
- Revisa el `report` completo para contexto detallado

---

## 🤝 Contribución

Si encuentras algún endpoint que falta o algún error en la colección:

1. Reporta el issue en GitHub
2. Envía PR con las correcciones
3. Actualiza esta documentación

---

**¡Happy Testing! 🎉**

Última actualización: 30 de octubre de 2025 - CU-27 Security Production-Ready Completado