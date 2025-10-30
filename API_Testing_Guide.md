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
- ✅ Registrar Usuario
- ✅ Login (guarda token automáticamente)
- ✅ Obtener Perfil Usuario
- ⏳ Refresh Token (pendiente implementar)
- ✅ Logout

### 📝 Listas de Compra (5 endpoints)
- ✅ Crear Lista
- ✅ Obtener Mis Listas (con paginación)
- ✅ Obtener Lista por ID
- ✅ Actualizar Lista
- ✅ Eliminar Lista

### 🛒 Productos (5 endpoints)
- ✅ Agregar Producto a Lista
- ✅ Obtener Productos de Lista (con filtros)
- ✅ Marcar/Desmarcar como Comprado
- ✅ Actualizar Producto
- ✅ Eliminar Producto

### 🏷️ Categorías (4 endpoints)
- ✅ Crear Categoría Personalizada
- ✅ Obtener Categorías por Tienda
- ✅ Actualizar Categoría
- ✅ Eliminar Categoría

### 🏪 Tiendas (5 endpoints)
- ✅ Crear Tienda
- ✅ Obtener Todas las Tiendas (con filtros)
- ✅ Obtener Tienda por ID
- ✅ Actualizar Tienda
- ✅ Eliminar Tienda

### 📤 Invitaciones (5 endpoints)
- ✅ Compartir Lista (genera enlace)
- ✅ Acceder a Lista Compartida (sin auth)
- ✅ Obtener Invitaciones de Lista
- ✅ Actualizar Permisos
- ✅ Cancelar Invitación

### 🤖 Inteligencia Artificial (7 endpoints)
- ✅ Sugerencias de Categorías (`POST /ai/category-suggestions`)
- ✅ Health Check IA (`GET /ai/health`)
- ✅ Información de Uso (`GET /ai/usage` - Solo Admin)
- ✅ **CU-29:** Categorización Masiva (`POST /ai/bulk-categorize`) - 🆕 **30 Oct 2025**
- ✅ **CU-32:** Obtener Ocasiones Disponibles (`GET /occasion-lists/occasions`)
- ✅ **CU-32:** Generar Lista por Ocasión (`POST /occasion-lists/generate`)
- ✅ **CU-32:** Preview Lista por Ocasión (`POST /occasion-lists/preview`)

### 📋 Blueprints/Plantillas (6 endpoints)
- ✅ Crear Blueprint (`POST /blueprints`)
- ✅ Obtener Mis Blueprints (`GET /blueprints/my`)
- ✅ Obtener Blueprints Públicos (`GET /blueprints/public`)
- ✅ Obtener Blueprint por ID (`GET /blueprints/:id`)
- ✅ Crear Lista desde Blueprint (`POST /blueprints/:id/create-list`)
- ✅ Actualizar/Eliminar Blueprint (`PUT/DELETE /blueprints/:id`)

### 👑 Administración (4 endpoints)
- ✅ Impersonar Usuario (`POST /admin/impersonate/:targetUserId`)
- ✅ Finalizar Impersonación (`POST /admin/end-impersonation`)
- ✅ Auditoría de Impersonaciones (`GET /admin/audit/impersonations`)
- ✅ Health Check Admin (`GET /admin/health`)

### 📊 Dashboard y Monitoreo (4 endpoints)
- ✅ Métricas del Sistema (`GET /dashboard/metrics`)
- ✅ Health Check Sistema (`GET /dashboard/health`)
- ✅ Alertas del Sistema (`GET /dashboard/alerts`)
- ✅ Análisis de Performance (`GET /dashboard/performance`)

### 🔒 Seguridad y Cache (5 endpoints) - **NUEVOS**
- ✅ Estado de Integridad (`GET /admin/cache/integrity/status`)
- ✅ Escanear Corrupción (`POST /admin/cache/integrity/scan`)
- ✅ Limpiar Cache Corrupto (`POST /admin/cache/integrity/cleanup`)
- ✅ Reparar Cache (`POST /admin/cache/integrity/repair`)
- ✅ Métricas de Integridad (`GET /admin/cache/integrity/metrics`)

### 🤖 Recomendaciones con IA (3 endpoints) - **CU-33 NUEVOS (30 Oct 2025)**
- ✅ Recomendaciones Generales (`GET /recommendations/:listId`)
- ✅ Recomendaciones Específicas (`GET /recommendations/:listId/for-product/:productId`)
- ✅ Ejemplos de Contexto (`GET /recommendations/context-examples`) - Público

**Total de Endpoints:** **47+ endpoints** (6 de IA: CU-28, CU-32, CU-33)

### 📊 Dashboard de Monitoreo (4 endpoints)
- ✅ Métricas del Sistema (`GET /dashboard/metrics`)
- ✅ Estado de Salud (`GET /dashboard/health`)
- ✅ Alertas Activas (`GET /dashboard/alerts`)
- ✅ Performance Detallado (`GET /dashboard/performance`)

### 🔧 Desarrollo (3 endpoints)
- ✅ Info Sistema de Eventos
- ✅ Reset Sistema de Eventos
- ✅ Publicar Evento de Prueba

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
1. Autenticación → Login como Admin
2. Cache Integrity → Estado de Integridad
3. Cache Integrity → Escanear Corrupción 
4. Cache Integrity → Ver Métricas de Integridad
5. Cache Integrity → Limpiar Cache (si hay corrupción)
6. Cache Integrity → Reparar Cache (opcional)
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
  "data": {
    "status": "healthy",
    "totalChecked": 150,
    "corruptedFound": 0,
    "integrityScore": 100,
    "lastScan": "2025-10-29T10:30:00Z"
  }
}
```

## 🚨 Notas Importantes

### ⚠️ Colección Postman Pendiente de Actualización
**Endpoints disponibles en la colección actual:**
- ✅ Autenticación (5 endpoints)
- ✅ Listas de Compra (5 endpoints)  
- ✅ Productos (5 endpoints)
- ✅ Categorías (4 endpoints)
- ✅ Tiendas (5 endpoints)
- ✅ Invitaciones (5 endpoints)
- ✅ Dashboard de Monitoreo (4 endpoints)
- ✅ Desarrollo (3 endpoints)
- ✅ **Inteligencia Artificial (7 endpoints)** - Fases 9, 15, 17 ✅ Implementados (CU-28, CU-29, CU-32)
- ✅ **Blueprints/Plantillas (6 endpoints)** - Fase 10 ✅ Implementados
- ✅ **Administración (4 endpoints)** - Fase 11 ✅ Implementados
- ✅ **Seguridad y Cache (5 endpoints)** - Fase 12 ✅ Implementados

**Total: 48 endpoints completamente documentados** ✅

> **✅ Actualizado**: Todos los endpoints de IA (incluye **Categorización Masiva CU-29**, **Listas Inteligentes por Ocasión CU-32**), Blueprints, Admin y Seguridad están completamente implementados, funcionando y **documentados en esta colección**. También disponibles en Swagger UI: `/api/docs`

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
  "invitationHash": "secure-hash-here"
}
```

#### Paso 5: Inteligencia Artificial (🤖 IA)
```
11. AI → Sugerencias de Categorías (nombre producto)
11. AI → 🆕 Categorización Masiva (hasta 50 productos)
11. AI → Health Check IA
11. AI → Información de Uso (solo admin)
11. AI → Obtener Ocasiones Disponibles (20+ ocasiones)
11. AI → Generar Lista por Ocasión (barbacoa, cena romántica, etc.)
11. AI → Preview Lista por Ocasión (sin guardar en DB)
```

#### Paso 6: Blueprints/Plantillas (📋 Templates)
```
12. Blueprints → Crear Blueprint (desde lista existente)
12. Blueprints → Obtener Mis Blueprints
12. Blueprints → Obtener Blueprints Públicos
12. Blueprints → Crear Lista desde Blueprint
12. Blueprints → Actualizar/Eliminar Blueprint
```

#### Paso 7: Funcionalidades Administrativas (⚠️ Solo Admins)
```
13. Admin → Impersonar Usuario
13. Admin → Consultar Auditoría (filtros: fecha, usuario)
13. Admin → Finalizar Impersonación
13. Admin → Health Check Admin
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