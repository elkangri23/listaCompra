# AGENTS.md - Lista de la Compra Colaborativa

## Descripción del Proyecto
Sistema de gestión de listas de compra colaborativas con arquitectura limpia (hexagonal), patrón SAGA/Outbox para eventos, inteligencia artificial para sugerencias y análisis, y autenticación segura con JWT.

## Referencias de Documentación
- **Análisis de requisitos**: `./Doc/Analisis-de-requisitos-ListaCompra.pdf`
- **Diagrama de clases**: `./Doc/DiagramaClases_V1-mermaid.md`
- **Casos de uso completos**: `./Doc/casos-uso-completos.md`

## Objetivos Generales
- Implementar arquitectura limpia con separación en capas (Domain, Application, Infrastructure, Adapters)
- Aplicar principios SOLID y clean architecture
- Implementar patrón SAGA/Outbox para consistencia eventual
- Integrar mensajería asíncrona con RabbitMQ
- Añadir funcionalidades de IA para análisis y sugerencias
- Testing completo (unitarios, integración, E2E)
- API REST documentada con OpenAPI/Swagger

## Stack Tecnológico Principal
- **Runtime**: Node.js v20+
- **Lenguaje**: TypeScript 5.x
- **Framework Web**: Express o Fastify
- **Base de datos**: PostgreSQL 15+
- **ORM**: Prisma 5.x
- **Mensajería**: RabbitMQ (amqplib)
- **Autenticación**: JWT (jsonwebtoken), bcrypt
- **Testing**: Jest, Supertest
- **Validación**: Zod o Joi
- **Documentación**: Swagger/OpenAPI (swagger-ui-express)
- **Code Quality**: ESLint, Prettier
- **IA**: OpenAI API, Anthropic Claude, Google Gemini o Azure OpenAI

---

## Roadmap de Implementación

### Fase 1: Setup y Arquitectura Base (Semanas 1-2)
**Casos de uso**: Ninguno (infraestructura)

#### Entregables:
1. Estructura de carpetas según arquitectura hexagonal
2. Configuración de TypeScript, ESLint, Prettier
3. Setup de base de datos PostgreSQL con Prisma
4. Configuración de variables de entorno
5. Setup de servidor Express/Fastify
6. Middleware de logging y manejo de errores

#### Estructura de carpetas:
```
src/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── repositories/
│   └── events/
├── application/
│   ├── use-cases/
│   ├── services/
│   └── dtos/
├── infrastructure/
│   ├── persistence/
│   │   ├── prisma/
│   │   └── repositories/
│   ├── messaging/
│   │   ├── rabbitmq/
│   │   └── outbox/
│   └── external-services/
│       └── ai/
└── adapters/
    ├── http/
    │   ├── controllers/
    │   ├── middlewares/
    │   └── routes/
    └── events/
```

---

### Fase 2: Autenticación y Gestión de Usuarios (Semana 3)
**Casos de uso**: CU-01, CU-02

#### Entregables:
1. Entidad Usuario en dominio
2. Casos de uso: RegisterUser, AuthenticateUser
3. Repositorio de usuarios (Prisma)
4. Endpoints: POST /auth/register, POST /auth/login
5. Middleware de autenticación JWT
6. Tests unitarios y de integración

---

### Fase 3: Gestión de Listas (Semana 4)
**Casos de uso**: CU-03, CU-04, CU-05, CU-06

#### Entregables:
1. Entidad Lista en dominio
2. Casos de uso: CreateList, GetUserLists, UpdateList, DeleteList
3. Repositorio de listas
4. Endpoints CRUD: POST /lists, GET /lists, PUT /lists/:id, DELETE /lists/:id
5. Validación de propiedad y permisos
6. Tests completos

---

### Fase 4: Gestión de Productos (Semana 5)
**Casos de uso**: CU-07, CU-08, CU-09, CU-10

#### Entregables:
1. Entidad Producto en dominio
2. Casos de uso: AddProduct, MarkProductAsPurchased, UpdateProduct, DeleteProduct
3. Repositorio de productos
4. Endpoints: POST /lists/:id/products, PATCH /products/:id/purchased, PUT /products/:id, DELETE /products/:id
5. Validación de permisos de escritura
6. Tests completos

---

### Fase 5: Gestión de Categorías y Tiendas (Semana 6)
**Casos de uso**: CU-11, CU-12, CU-13, CU-14, CU-26

#### Entregables:
1. Entidades Categoria y Tienda en dominio
2. Casos de uso: CreateCategory, GetCategoriesByStore, UpdateCategory, DeleteCategory, GetStores
3. Repositorios correspondientes
4. Endpoints: POST /categories, GET /stores/:id/categories, PUT /categories/:id, DELETE /categories/:id, GET /stores
5. Tests completos

---

### Fase 6: Patrón Outbox y RabbitMQ (Semana 7)
**Casos de uso**: CU-19

#### Entregables:
1. Tabla outbox en base de datos
2. Servicio de Outbox para persistir eventos
3. Worker para procesar eventos del outbox
4. Configuración de RabbitMQ
5. Publisher y Consumer de mensajes
6. Eventos de dominio: ListaCompartida, UsuarioRegistrado, ProductoAñadido
7. Tests de integración con RabbitMQ

---

### Fase 7: Compartición de Listas (Semana 8)
**Casos de uso**: CU-15, CU-16, CU-17, CU-18

#### Entregables:
1. Entidades Invitacion y Permiso en dominio
2. Casos de uso: ShareList, AccessSharedList, ManagePermissions, CancelInvitation
3. Generación de hash seguro para enlaces
4. Endpoints: POST /lists/:id/share, GET /shared/:hash, PUT /invitations/:id/permissions, DELETE /invitations/:id
5. Lógica de permisos (lectura/escritura)
6. Publicación de evento "ListaCompartida" al outbox
7. Tests completos

---

### Fase 8: Notificaciones por Email (Semana 9)
**Casos de uso**: CU-19 (continuación)

#### Entregables:
1. Servicio de envío de emails (Nodemailer o similar)
2. Worker que consume eventos "ListaCompartida" desde RabbitMQ
3. Plantillas de emails para invitaciones
4. Lógica de retry con backoff exponencial
5. Logs de notificaciones enviadas
6. Tests de integración

---

### Fase 9: Integración con IA (Semanas 10-11)
**Casos de uso**: CU-20, CU-21

#### Entregables:
1. Servicio de IA en infrastructure/external-services
2. Caso de uso: GetCategorySuggestions, AnalyzePurchaseHabits
3. Integración con API de OpenAI/Gemini/Perplexity
4. Endpoints: POST /ai/category-suggestions, GET /ai/habits-analysis
5. Caché de respuestas para optimizar costos
6. Manejo de timeouts y fallbacks
7. Tests con mocks de API externa

---

### Fase 10: Blueprints/Plantillas (Semana 12)
**Casos de uso**: CU-22, CU-23

#### Entregables:
1. Entidad Blueprint en dominio
2. Casos de uso: CreateBlueprint, CreateListFromBlueprint
3. Repositorio de blueprints
4. Endpoints: POST /blueprints, POST /lists/from-blueprint/:id
5. Tests completos

---

### Fase 11: Funcionalidades de Administrador (Semana 13)
**Casos de uso**: CU-24, CU-25

#### Entregables:
1. Middleware de autorización por roles
2. Casos de uso: ImpersonateUser, EndImpersonation
3. Endpoints: POST /admin/impersonate, DELETE /admin/impersonate
4. Logs de auditoría para impersonaciones
5. Tests de seguridad

---

### Fase 12: Validación y Seguridad (Semana 14)
**Casos de uso**: CU-27

#### Entregables:
1. Proceso cron para validar enlaces expirados
2. Implementación de rate limiting
3. Protección CSRF
4. Sanitización de inputs
5. Validación exhaustiva con Zod/Joi
6. Tests de seguridad

---

### Fase 13: Documentación y Testing Final (Semana 15)
#### Entregables:
1. Documentación OpenAPI/Swagger completa
2. Cobertura de tests >80%
3. Tests E2E completos
4. README detallado
5. Documentación de arquitectura
6. Guía de deployment

---

## Agentes de Desarrollo

### agente-domain
**Responsabilidad**: Capa de dominio (lógica de negocio pura)

**Herramientas**: TypeScript

**Tareas**:
- Definir entidades del dominio (Usuario, Lista, Producto, Categoria, Tienda, Invitacion, Permiso, Blueprint)
- Crear value objects para encapsular lógica (Email, Password, Hash)
- Definir interfaces de repositorios (puertos)
- Modelar eventos de dominio
- Implementar reglas de negocio sin dependencias externas
- Escribir tests unitarios para la lógica de dominio

**Referencias**:
- Casos de uso: Todos
- Diagrama de clases: `./Doc/DiagramaClases_V1-mermaid.md`

---

### agente-application
**Responsabilidad**: Casos de uso y orquestación de lógica de aplicación

**Herramientas**: TypeScript

**Tareas**:
- Implementar los 27 casos de uso definidos
- Crear DTOs para entrada/salida de cada caso de uso
- Orquestar llamadas a repositorios y servicios
- Validar reglas de negocio
- Publicar eventos de dominio
- Escribir tests unitarios con mocks de repositorios

**Referencias**:
- Casos de uso completos: `./Doc/casos-uso-completos.md`
- Análisis de requisitos: `./Doc/Analisis-de-requisitos-ListaCompra.pdf`

---

### agente-infrastructure-persistence
**Responsabilidad**: Persistencia de datos

**Herramientas**: PostgreSQL, Prisma, TypeScript

**Tareas**:
- Definir schema de Prisma según diagrama de clases
- Implementar repositorios concretos (adaptadores)
- Mapear entre entidades de dominio y modelos de Prisma
- Gestionar migraciones de base de datos
- Implementar patrón Repository
- Implementar tabla y lógica de Outbox
- Escribir tests de integración con base de datos

**Referencias**:
- Diagrama de clases: `./Doc/DiagramaClases_V1-mermaid.md`

---

### agente-infrastructure-messaging
**Responsabilidad**: Mensajería asíncrona y patrón Outbox

**Herramientas**: RabbitMQ, amqplib, TypeScript

**Tareas**:
- Configurar conexión con RabbitMQ
- Implementar publisher de eventos
- Implementar consumers de eventos
- Crear worker del Outbox (polling o CDC)
- Gestionar reintentos y dead letter queues
- Implementar serialización/deserialización de eventos
- Escribir tests de integración con RabbitMQ

**Referencias**:
- Casos de uso: CU-15, CU-19
- Análisis de requisitos (eventos): `./Doc/Analisis-de-requisitos-ListaCompra.pdf`

---

### agente-infrastructure-external
**Responsabilidad**: Servicios externos (IA, email, etc.)

**Herramientas**: OpenAI API, Nodemailer, TypeScript

**Tareas**:
- Integrar APIs de IA (OpenAI, Gemini, Perplexity)
- Implementar servicio de envío de emails
- Gestionar timeouts y fallbacks
- Implementar caché de respuestas IA
- Crear adaptadores para servicios externos
- Escribir tests con mocks de APIs externas

**Referencias**:
- Casos de uso: CU-19, CU-20, CU-21

---

### agente-adapters-http
**Responsabilidad**: API REST (controladores, rutas, middlewares)

**Herramientas**: Express/Fastify, TypeScript

**Tareas**:
- Crear controladores para cada endpoint
- Definir rutas y asociarlas a casos de uso
- Implementar middlewares (auth, validación, errores, logging, rate limiting)
- Validar requests con Zod/Joi
- Mapear entre DTOs y JSON
- Gestionar respuestas HTTP y códigos de estado
- Escribir tests de integración (Supertest)

**Referencias**:
- Casos de uso completos: `./Doc/casos-uso-completos.md`

---

### agente-security
**Responsabilidad**: Autenticación, autorización y seguridad

**Herramientas**: bcrypt, jsonwebtoken, helmet, TypeScript

**Tareas**:
- Implementar encriptación de contraseñas con bcrypt
- Generar y validar tokens JWT
- Crear middleware de autenticación
- Crear middleware de autorización por roles
- Implementar rate limiting
- Protección CSRF
- Sanitización de inputs
- Generar hashes seguros para invitaciones
- Escribir tests de seguridad

**Referencias**:
- Casos de uso: CU-01, CU-02, CU-15, CU-24, CU-27

---

### agente-testing
**Responsabilidad**: Testing completo de la aplicación

**Herramientas**: Jest, Supertest, TypeScript

**Tareas**:
- Configurar Jest y cobertura
- Escribir tests unitarios para cada capa
- Escribir tests de integración
- Escribir tests E2E completos
- Crear mocks y stubs necesarios
- Mantener cobertura >80%
- Setup de base de datos de test
- Tests de rendimiento básicos

**Referencias**:
- Todos los casos de uso: `./Doc/casos-uso-completos.md`

---

### agente-documentation
**Responsabilidad**: Documentación técnica y de API

**Herramientas**: Swagger/OpenAPI, Markdown

**Tareas**:
- Documentar todos los endpoints con OpenAPI
- Generar UI interactiva con Swagger
- Incluir ejemplos de requests/responses
- Documentar códigos de error
- Crear README detallado
- Documentar arquitectura del proyecto
- Crear guía de setup y deployment
- Documentar decisiones de diseño

**Referencias**:
- Análisis de requisitos: `./Doc/Analisis-de-requisitos-ListaCompra.pdf`
- Casos de uso: `./Doc/casos-uso-completos.md`
- Diagrama de clases: `./Doc/DiagramaClases_V1-mermaid.md`

---

## Dependencias NPM Necesarias

### Producción
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "@prisma/client": "^5.7.0",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "zod": "^3.22.4",
    "amqplib": "^0.10.3",
    "nodemailer": "^6.9.7",
    "openai": "^4.20.1",
    "dotenv": "^16.3.1",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5",
    "cors": "^2.8.5",
    "morgan": "^1.10.0",
    "swagger-ui-express": "^5.0.0",
    "uuid": "^9.0.1"
  }
}
```

### Desarrollo
```json
{
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/node": "^20.10.5",
    "@types/express": "^4.17.21",
    "@types/bcrypt": "^5.0.2",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/amqplib": "^0.10.4",
    "@types/nodemailer": "^6.4.14",
    "@types/cors": "^2.8.17",
    "@types/morgan": "^1.9.9",
    "@types/swagger-ui-express": "^4.1.6",
    "@types/uuid": "^9.0.7",
    "prisma": "^5.7.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "@types/jest": "^29.5.11",
    "supertest": "^6.3.3",
    "@types/supertest": "^6.0.2",
    "eslint": "^8.56.0",
    "@typescript-eslint/parser": "^6.16.0",
    "@typescript-eslint/eslint-plugin": "^6.16.0",
    "prettier": "^3.1.1",
    "ts-node": "^10.9.2",
    "nodemon": "^3.0.2"
  }
}
```

---

## Comandos Útiles

### Setup inicial
```bash
npm install
npx prisma generate
npx prisma migrate dev
```

### Desarrollo
```bash
npm run dev          # Inicia servidor en modo desarrollo
npm run test         # Ejecuta tests
npm run test:watch   # Tests en modo watch
npm run test:cov     # Tests con cobertura
npm run lint         # Ejecuta linter
npm run format       # Formatea código
```

### Prisma
```bash
npx prisma studio    # UI para ver base de datos
npx prisma migrate dev --name <nombre>  # Crear migración
npx prisma db seed   # Poblar datos iniciales
```

### RabbitMQ (Docker)
```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:management
```

### PostgreSQL (Docker)
```bash
docker run -d --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 postgres:15
```

---

## Criterios de Aceptación por Fase

Cada fase debe cumplir:
1. ✅ Código implementado según arquitectura hexagonal
2. ✅ Tests con cobertura >80% en la capa correspondiente
3. ✅ Documentación actualizada (inline y README)
4. ✅ Linter y formateador sin errores
5. ✅ Endpoints documentados en Swagger
6. ✅ Revisión de código completada

---

## Notas Finales

- Priorizar **separación de responsabilidades** según arquitectura hexagonal
- Mantener **independencia del dominio** de frameworks y librerías externas
- Aplicar **principios SOLID** en cada capa
- Implementar **inyección de dependencias** para facilitar testing
- Usar **interfaces/contratos** en lugar de implementaciones concretas
- Documentar **decisiones arquitectónicas** importantes
- Crear **logs estructurados** para facilitar debugging
- Implementar **health checks** para monitoreo

Este roadmap está diseñado para cubrir todos los casos de uso definidos aplicando arquitectura limpia, SAGA/Outbox y buenas prácticas de desarrollo.
