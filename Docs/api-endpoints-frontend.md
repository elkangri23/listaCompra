# 📚 Endpoints REST para Frontend (Next.js)

Esta guía resume los endpoints principales y avanzados de la API Lista de la Compra Colaborativa, listos para consumir desde un frontend Next.js.

---

## 1. Autenticación
- `POST /api/v1/auth/register` — Registrar usuario
- `POST /api/v1/auth/login` — Login y obtención de tokens
- `GET /api/v1/auth/me` — Perfil usuario autenticado
- `POST /api/v1/auth/refresh` — Refresh token (pendiente)
- `POST /api/v1/auth/logout` — Logout

## 2. Listas de Compra
- `POST /api/v1/lists` — Crear lista
- `GET /api/v1/lists` — Obtener listas del usuario (paginación)
- `GET /api/v1/lists/:id` — Obtener lista por ID
- `PUT /api/v1/lists/:id` — Actualizar lista
- `DELETE /api/v1/lists/:id` — Eliminar lista

## 3. Productos
- `POST /api/v1/lists/:listId/products` — Añadir producto a lista
- `GET /api/v1/lists/:listId/products` — Obtener productos de lista (filtros)
- `PATCH /api/v1/lists/:listId/products/:productId/purchased` — Marcar producto como comprado
- `PUT /api/v1/lists/:listId/products/:productId` — Actualizar producto
- `DELETE /api/v1/lists/:listId/products/:productId` — Eliminar producto

## 4. Categorías
- `POST /api/v1/categories` — Crear categoría
- `GET /api/v1/categories?tiendaId=...` — Obtener categorías por tienda
- `PUT /api/v1/categories/:id` — Actualizar categoría
- `DELETE /api/v1/categories/:id` — Eliminar categoría

## 5. Tiendas
- `POST /api/v1/stores` — Crear tienda
- `GET /api/v1/stores` — Listar tiendas
- `GET /api/v1/stores/:id` — Obtener tienda por ID
- `PUT /api/v1/stores/:id` — Actualizar tienda
- `DELETE /api/v1/stores/:id` — Eliminar tienda

## 6. Invitaciones y Compartición
- `POST /api/v1/invitations/:listId/share` — Compartir lista
- `GET /api/v1/invitations/access/:hash` — Acceder a lista compartida
- `GET /api/v1/invitations/:listId` — Invitaciones activas de lista
- `PUT /api/v1/invitations/:listId/permissions/:hash` — Actualizar permisos
- `DELETE /api/v1/invitations/:listId/:hash` — Cancelar invitación

## 7. Blueprints (Plantillas)
- `POST /api/v1/blueprints` — Crear blueprint
- `GET /api/v1/blueprints` — Listar blueprints usuario
- `GET /api/v1/blueprints/:id` — Obtener blueprint
- `POST /api/v1/blueprints/:id/create-list` — Crear lista desde blueprint
- `PUT /api/v1/blueprints/:id` — Actualizar blueprint
- `DELETE /api/v1/blueprints/:id` — Eliminar blueprint

## 8. IA - Listas por Ocasión
- `GET /api/v1/occasion-lists/occasions` — Ocasiones disponibles
- `POST /api/v1/occasion-lists/generate` — Generar lista por ocasión
- `POST /api/v1/occasion-lists/preview` — Preview lista por ocasión

## 9. IA - Categorización Masiva
- `POST /api/v1/ai/bulk-categorize` — Categorización masiva de productos (batch)

## 10. IA - Recomendaciones
- `GET /api/v1/recommendations/context-examples` — Ejemplos de contexto (público)
- `GET /api/v1/recommendations/:listId` — Recomendaciones generales
- `GET /api/v1/recommendations/:listId/for-product/:productId` — Recomendaciones por producto

## 11. Administración
- `POST /api/v1/admin/impersonate/:userId` — Impersonar usuario
- `POST /api/v1/admin/end-impersonation` — Finalizar impersonación
- `GET /api/v1/admin/audit-logs` — Logs de auditoría
- `GET /api/v1/admin/users` — Gestión de usuarios
- `GET /api/v1/admin/security/test` — Test de seguridad (solo admin)

## 12. Dashboard y Monitoreo
- `GET /api/v1/dashboard/metrics` — Métricas del sistema
- `GET /api/v1/dashboard/health` — Estado de salud
- `GET /api/v1/dashboard/alerts` — Alertas activas
- `GET /api/v1/dashboard/performance` — Performance detallado

---

**Notas:**
- Todos los endpoints requieren JWT salvo los públicos y algunos de invitaciones.
- La colección Postman incluye ejemplos de request/response y scripts para automatizar flujos.
- Los endpoints de IA y administración pueden tener rate limiting y restricciones de rol.

---

**Referencia rápida para desarrollo Next.js:**
- Usa `fetch` o `axios` con el endpoint correspondiente y el token JWT en el header `Authorization: Bearer <token>`.
- Consulta la colección Postman para ejemplos de payload y respuestas.
- Para endpoints de IA, revisa los parámetros y límites en la colección.

---

*Actualizado: 31/10/2025*
