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

### 🤖 Inteligencia Artificial (3 endpoints)
- ✅ Sugerencias de Categorías (`POST /ai/category-suggestions`)
- ✅ Health Check IA (`GET /ai/health`)
- ✅ Información de Uso (`GET /ai/usage` - Solo Admin)

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

**Endpoints pendientes de añadir:**
- ⏳ **Inteligencia Artificial (3 endpoints)** - Fase 9
- ⏳ **Blueprints/Plantillas (6 endpoints)** - Fase 10  
- ⏳ **Administración (4 endpoints)** - Fase 11

> **Nota**: Los endpoints de IA, Blueprints y Admin están implementados y funcionando, pero aún no están incluidos en `postman_collection.json`. Consulta la documentación Swagger en `/api-docs` o prueba manualmente con Thunder Client/Postman.

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
11. AI → Health Check IA
11. AI → Información de Uso (solo admin)
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

## 🤝 Contribución

Si encuentras algún endpoint que falta o algún error en la colección:

1. Reporta el issue en GitHub
2. Envía PR con las correcciones
3. Actualiza esta documentación

---

**¡Happy Testing! 🎉**

Última actualización: 29 de octubre de 2025 - Fase 11 Admin Completada