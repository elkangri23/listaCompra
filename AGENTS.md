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

## Arquitectura y Estructura de Carpetas

```
/
├── src/
│   ├── domain/                          # Capa de dominio (lógica de negocio pura)
│   │   ├── entities/                    # Entidades de dominio
│   │   │   ├── Usuario.ts
│   │   │   ├── Lista.ts
│   │   │   ├── Producto.ts
│   │   │   ├── Categoria.ts
│   │   │   ├── Tienda.ts
│   │   │   ├── Invitacion.ts
│   │   │   ├── Permiso.ts
│   │   │   └── Blueprint.ts
│   │   ├── value-objects/               # Value Objects inmutables
│   │   │   ├── Email.ts
│   │   │   ├── Password.ts
│   │   │   ├── Hash.ts
│   │   │   └── PermissionType.ts
│   │   ├── services/                    # Domain services puros
│   │   │   ├── PasswordHasher.ts
│   │   │   └── InvitationHashGenerator.ts
│   │   ├── events/                      # Eventos de dominio (puros)
│   │   │   ├── UsuarioRegistrado.ts
│   │   │   ├── ListaCreada.ts
│   │   │   ├── ListaCompartida.ts
│   │   │   ├── ProductoAnadido.ts
│   │   │   └── InvitacionEnviada.ts
│   │   └── errors/                      # Errores de dominio
│   │       ├── DomainError.ts
│   │       ├── InvalidEmailError.ts
│   │       └── InvalidPasswordError.ts
│   │
│   ├── application/                     # Capa de aplicación (casos de uso)
│   │   ├── use-cases/                   # Orquestación por caso de uso
│   │   │   ├── auth/
│   │   │   │   ├── RegisterUser.ts
│   │   │   │   └── AuthenticateUser.ts
│   │   │   ├── lists/
│   │   │   │   ├── CreateList.ts
│   │   │   │   ├── GetUserLists.ts
│   │   │   │   ├── UpdateList.ts
│   │   │   │   ├── DeleteList.ts
│   │   │   │   └── ShareList.ts
│   │   │   ├── products/
│   │   │   │   ├── AddProduct.ts
│   │   │   │   ├── MarkProductAsPurchased.ts
│   │   │   │   ├── UpdateProduct.ts
│   │   │   │   └── DeleteProduct.ts
│   │   │   ├── categories/
│   │   │   │   ├── CreateCategory.ts
│   │   │   │   ├── GetCategoriesByStore.ts
│   │   │   │   ├── UpdateCategory.ts
│   │   │   │   └── DeleteCategory.ts
│   │   │   ├── invitations/
│   │   │   │   ├── AccessSharedList.ts
│   │   │   │   ├── ManagePermissions.ts
│   │   │   │   └── CancelInvitation.ts
│   │   │   ├── ai/
│   │   │   │   ├── GetCategorySuggestions.ts
│   │   │   │   └── AnalyzePurchaseHabits.ts
│   │   │   ├── blueprints/
│   │   │   │   ├── CreateBlueprint.ts
│   │   │   │   └── CreateListFromBlueprint.ts
│   │   │   └── admin/
│   │   │       ├── ImpersonateUser.ts
│   │   │       └── EndImpersonation.ts
│   │   ├── ports/                       # Interfaces (puertos)
│   │   │   ├── repositories/
│   │   │   │   ├── IUsuarioRepository.ts
│   │   │   │   ├── IListaRepository.ts
│   │   │   │   ├── IProductoRepository.ts
│   │   │   │   ├── ICategoriaRepository.ts
│   │   │   │   ├── ITiendaRepository.ts
│   │   │   │   ├── IInvitacionRepository.ts
│   │   │   │   ├── IPermisoRepository.ts
│   │   │   │   └── IBlueprintRepository.ts
│   │   │   ├── messaging/
│   │   │   │   ├── IEventPublisher.ts
│   │   │   │   └── IOutboxService.ts
│   │   │   ├── external/
│   │   │   │   ├── IEmailService.ts
│   │   │   │   └── IAIService.ts
│   │   │   └── auth/
│   │   │       ├── ITokenService.ts
│   │   │       └── IPasswordHasher.ts
│   │   ├── dto/                         # DTOs de entrada/salida
│   │   │   ├── auth/
│   │   │   │   ├── RegisterUserDto.ts
│   │   │   │   └── LoginDto.ts
│   │   │   ├── lists/
│   │   │   │   ├── CreateListDto.ts
│   │   │   │   └── UpdateListDto.ts
│   │   │   ├── products/
│   │   │   │   ├── AddProductDto.ts
│   │   │   │   └── UpdateProductDto.ts
│   │   │   └── shared/
│   │   │       └── PaginationDto.ts
│   │   └── errors/                      # Errores de aplicación
│   │       ├── ValidationError.ts
│   │       ├── UnauthorizedError.ts
│   │       └── NotFoundError.ts
│   │
│   ├── infrastructure/                  # Capa de infraestructura (adaptadores)
│   │   ├── persistence/
│   │   │   ├── prisma/
│   │   │   │   ├── schema.prisma        # Schema de Prisma
│   │   │   │   ├── migrations/          # Migraciones
│   │   │   │   └── seed.ts              # Datos iniciales
│   │   │   ├── repositories/            # Implementaciones concretas
│   │   │   │   ├── PrismaUsuarioRepository.ts
│   │   │   │   ├── PrismaListaRepository.ts
│   │   │   │   ├── PrismaProductoRepository.ts
│   │   │   │   ├── PrismaCategoriaRepository.ts
│   │   │   │   ├── PrismaTiendaRepository.ts
│   │   │   │   ├── PrismaInvitacionRepository.ts
│   │   │   │   ├── PrismaPermisoRepository.ts
│   │   │   │   ├── PrismaBlueprintRepository.ts
│   │   │   │   └── PrismaOutboxRepository.ts
│   │   │   ├── mappers/                 # Mapeo entidad ↔ modelo persistencia
│   │   │   │   ├── UsuarioMapper.ts
│   │   │   │   ├── ListaMapper.ts
│   │   │   │   └── ProductoMapper.ts
│   │   │   └── in-memory/               # Dobles para testing
│   │   │       ├── InMemoryUsuarioRepository.ts
│   │   │       └── InMemoryListaRepository.ts
│   │   ├── http/                        # Adaptadores HTTP
│   │   │   ├── controllers/             # Controladores REST
│   │   │   │   ├── AuthController.ts
│   │   │   │   ├── ListController.ts
│   │   │   │   ├── ProductController.ts
│   │   │   │   ├── CategoryController.ts
│   │   │   │   ├── InvitationController.ts
│   │   │   │   ├── AIController.ts
│   │   │   │   ├── BlueprintController.ts
│   │   │   │   └── AdminController.ts
│   │   │   ├── middlewares/             # Middlewares HTTP
│   │   │   │   ├── authMiddleware.ts
│   │   │   │   ├── roleMiddleware.ts
│   │   │   │   ├── validationMiddleware.ts
│   │   │   │   ├── errorMiddleware.ts
│   │   │   │   ├── rateLimitMiddleware.ts
│   │   │   │   └── loggerMiddleware.ts
│   │   │   ├── routes/                  # Definición de rutas
│   │   │   │   ├── authRoutes.ts
│   │   │   │   ├── listRoutes.ts
│   │   │   │   ├── productRoutes.ts
│   │   │   │   ├── categoryRoutes.ts
│   │   │   │   ├── invitationRoutes.ts
│   │   │   │   ├── aiRoutes.ts
│   │   │   │   ├── blueprintRoutes.ts
│   │   │   │   └── adminRoutes.ts
│   │   │   └── server.ts                # Bootstrap del servidor HTTP
│   │   ├── messaging/                   # Mensajería (RabbitMQ/Kafka)
│   │   │   ├── rabbitmq/
│   │   │   │   ├── RabbitMQConnection.ts
│   │   │   │   ├── RabbitMQPublisher.ts
│   │   │   │   └── RabbitMQConsumer.ts
│   │   │   ├── outbox/
│   │   │   │   ├── OutboxService.ts
│   │   │   │   ├── OutboxWorker.ts      # Worker para procesar outbox
│   │   │   │   └── OutboxPoller.ts
│   │   │   └── consumers/               # Consumers de eventos
│   │   │       ├── NotificationConsumer.ts
│   │   │       └── AuditConsumer.ts
│   │   ├── external-services/           # Servicios externos
│   │   │   ├── ai/
│   │   │   │   ├── OpenAIService.ts
│   │   │   │   └── AIServiceAdapter.ts
│   │   │   ├── email/
│   │   │   │   ├── NodemailerService.ts
│   │   │   │   └── templates/
│   │   │   │       └── invitation.html
│   │   │   └── auth/
│   │   │       ├── JWTTokenService.ts
│   │   │       └── BcryptPasswordHasher.ts
│   │   ├── observability/               # Observabilidad
│   │   │   ├── logger/
│   │   │   │   ├── Logger.ts
│   │   │   │   └── WinstonLogger.ts
│   │   │   ├── metrics/
│   │   │   │   └── MetricsCollector.ts
│   │   │   └── tracing/
│   │   │       └── TracingService.ts
│   │   └── config/                      # Configuración
│   │       ├── database.config.ts
│   │       ├── rabbitmq.config.ts
│   │       ├── jwt.config.ts
│   │       ├── ai.config.ts
│   │       └── env.ts                   # Variables de entorno
│   │
│   ├── composition/                     # Composición e inversión de dependencias
│   │   └── container.ts                 # Contenedor de inyección de dependencias
│   │
│   ├── shared/                          # Utilidades compartidas
│   │   ├── result.ts                    # Result/Either para manejo de errores
│   │   ├── types.ts                     # Tipos compartidos
│   │   └── utils.ts                     # Utilidades puras
│   │
│   └── main.ts                          # Punto de entrada de la aplicación
│
├── tests/                               # Tests organizados por capas
│   ├── unit/
│   │   ├── domain/
│   │   ├── application/
│   │   └── infrastructure/
│   ├── integration/
│   │   ├── http/
│   │   ├── persistence/
│   │   └── messaging/
│   └── e2e/
│       └── scenarios/
│
├── docs/                                # Documentación adicional
│   ├── Analisis-de-requisitos-ListaCompra.pdf
│   ├── DiagramaClases_V1-mermaid.md
│   ├── casos-uso-completos.md
│   ├── architecture.md
│   └── api-documentation.md
│
├── scripts/                             # Scripts auxiliares
│   ├── seed.ts
│   └── migrate.ts
│
├── .env.example                         # Plantilla de variables de entorno
├── .eslintrc.json                       # Configuración ESLint
├── .prettierrc                          # Configuración Prettier
├── jest.config.js                       # Configuración Jest
├── tsconfig.json                        # Configuración TypeScript
├── package.json
├── docker-compose.yml                   # PostgreSQL + RabbitMQ
└── README.md
```

---

## Roadmap de Implementación

### Fase 1: Setup y Arquitectura Base (Semanas 1-2)
**Casos de uso**: Ninguno (infraestructura)

#### Entregables:
1. Estructura de carpetas completa según arquitectura definida
2. Configuración de TypeScript, ESLint, Prettier
3. Setup de base de datos PostgreSQL con Prisma
4. Configuración de variables de entorno (`src/infrastructure/config/`)
5. Setup de servidor Express/Fastify (`src/infrastructure/http/server.ts`)
6. Contenedor de inyección de dependencias (`src/composition/container.ts`)
7. Utilidades base (Result, Logger, Error handlers)
8. Middleware de logging y manejo de errores
9. Docker Compose para PostgreSQL y RabbitMQ

---

### Fase 2: Autenticación y Gestión de Usuarios (Semana 3)
**Casos de uso**: CU-01, CU-02

#### Entregables:
1. Entidad Usuario en `src/domain/entities/Usuario.ts`
2. Value Objects: Email, Password en `src/domain/value-objects/`
3. Casos de uso en `src/application/use-cases/auth/`
4. Puertos: IUsuarioRepository, IPasswordHasher, ITokenService en `src/application/ports/`
5. Implementaciones: PrismaUsuarioRepository, BcryptPasswordHasher, JWTTokenService
6. Controlador AuthController en `src/infrastructure/http/controllers/`
7. Rutas en `src/infrastructure/http/routes/authRoutes.ts`
8. Middleware de autenticación en `src/infrastructure/http/middlewares/authMiddleware.ts`
9. Tests unitarios y de integración

---

### Fase 3: Gestión de Listas (Semana 4)
**Casos de uso**: CU-03, CU-04, CU-05, CU-06

#### Entregables:
1. Entidad Lista en `src/domain/entities/Lista.ts`
2. Casos de uso en `src/application/use-cases/lists/`
3. DTOs en `src/application/dto/lists/`
4. Puerto IListaRepository en `src/application/ports/repositories/`
5. PrismaListaRepository en `src/infrastructure/persistence/repositories/`
6. Mapper: ListaMapper en `src/infrastructure/persistence/mappers/`
7. ListController en `src/infrastructure/http/controllers/`
8. Rutas en `src/infrastructure/http/routes/listRoutes.ts`
9. Validación de propiedad y permisos
10. Tests completos

---

### Fase 4: Gestión de Productos (Semana 5)
**Casos de uso**: CU-07, CU-08, CU-09, CU-10

#### Entregables:
1. Entidad Producto en `src/domain/entities/Producto.ts`
2. Casos de uso en `src/application/use-cases/products/`
3. DTOs en `src/application/dto/products/`
4. IProductoRepository en `src/application/ports/repositories/`
5. PrismaProductoRepository en `src/infrastructure/persistence/repositories/`
6. ProductoMapper en `src/infrastructure/persistence/mappers/`
7. ProductController en `src/infrastructure/http/controllers/`
8. Rutas en `src/infrastructure/http/routes/productRoutes.ts`
9. Validación de permisos de escritura
10. Tests completos

---

### Fase 5: Gestión de Categorías y Tiendas (Semana 6)
**Casos de uso**: CU-11, CU-12, CU-13, CU-14, CU-26

#### Entregables:
1. Entidades Categoria y Tienda en `src/domain/entities/`
2. Casos de uso en `src/application/use-cases/categories/`
3. Puertos: ICategoriaRepository, ITiendaRepository
4. Implementaciones Prisma de repositorios
5. CategoryController en `src/infrastructure/http/controllers/`
6. Rutas en `src/infrastructure/http/routes/categoryRoutes.ts`
7. Tests completos

---

### Fase 6: Patrón Outbox y RabbitMQ (Semana 7)
**Casos de uso**: CU-19

#### Entregables:
1. Eventos de dominio en `src/domain/events/`
2. Puerto IOutboxService en `src/application/ports/messaging/`
3. Tabla outbox en schema de Prisma
4. OutboxService en `src/infrastructure/messaging/outbox/`
5. OutboxWorker y OutboxPoller en `src/infrastructure/messaging/outbox/`
6. RabbitMQConnection, RabbitMQPublisher en `src/infrastructure/messaging/rabbitmq/`
7. Configuración RabbitMQ en `src/infrastructure/config/rabbitmq.config.ts`
8. Tests de integración con RabbitMQ

---

### Fase 7: Compartición de Listas (Semana 8)
**Casos de uso**: CU-15, CU-16, CU-17, CU-18

#### Entregables:
1. Entidades Invitacion y Permiso en `src/domain/entities/`
2. Value Object Hash en `src/domain/value-objects/`
3. Casos de uso en `src/application/use-cases/invitations/`
4. Puertos: IInvitacionRepository, IPermisoRepository
5. Implementaciones Prisma de repositorios
6. InvitationController en `src/infrastructure/http/controllers/`
7. Rutas en `src/infrastructure/http/routes/invitationRoutes.ts`
8. Generación de hash seguro (domain service)
9. Publicación de evento "ListaCompartida" al outbox
10. Tests completos

---

### Fase 8: Notificaciones por Email (Semana 9)
**Casos de uso**: CU-19 (continuación)

#### Entregables:
1. Puerto IEmailService en `src/application/ports/external/`
2. NodemailerService en `src/infrastructure/external-services/email/`
3. Plantillas de email en `src/infrastructure/external-services/email/templates/`
4. NotificationConsumer en `src/infrastructure/messaging/consumers/`
5. RabbitMQConsumer en `src/infrastructure/messaging/rabbitmq/`
6. Lógica de retry con backoff exponencial
7. Tests de integración

---

### Fase 9: Integración con IA (Semanas 10-11)
**Casos de uso**: CU-20, CU-21

#### Entregables:
1. Puerto IAIService en `src/application/ports/external/`
2. Casos de uso en `src/application/use-cases/ai/`
3. OpenAIService y AIServiceAdapter en `src/infrastructure/external-services/ai/`
4. Configuración IA en `src/infrastructure/config/ai.config.ts`
5. AIController en `src/infrastructure/http/controllers/`
6. Rutas en `src/infrastructure/http/routes/aiRoutes.ts`
7. Caché de respuestas para optimizar costos
8. Manejo de timeouts y fallbacks
9. Tests con mocks de API externa

---

### Fase 10: Blueprints/Plantillas (Semana 12)
**Casos de uso**: CU-22, CU-23

#### Entregables:
1. Entidad Blueprint en `src/domain/entities/Blueprint.ts`
2. Casos de uso en `src/application/use-cases/blueprints/`
3. IBlueprintRepository en `src/application/ports/repositories/`
4. PrismaBlueprintRepository en `src/infrastructure/persistence/repositories/`
5. BlueprintController en `src/infrastructure/http/controllers/`
6. Rutas en `src/infrastructure/http/routes/blueprintRoutes.ts`
7. Tests completos

---

### Fase 11: Funcionalidades de Administrador (Semana 13)
**Casos de uso**: CU-24, CU-25

#### Entregables:
1. Middleware de autorización por roles en `src/infrastructure/http/middlewares/roleMiddleware.ts`
2. Casos de uso en `src/application/use-cases/admin/`
3. AdminController en `src/infrastructure/http/controllers/`
4. Rutas en `src/infrastructure/http/routes/adminRoutes.ts`
5. Logs de auditoría para impersonaciones
6. Tests de seguridad

---

### Fase 12: Validación y Seguridad (Semana 14)
**Casos de uso**: CU-27

#### Entregables:
1. Proceso cron para validar enlaces expirados
2. Rate limiting middleware en `src/infrastructure/http/middlewares/rateLimitMiddleware.ts`
3. Protección CSRF
4. Sanitización de inputs
5. Validación exhaustiva con Zod en `src/infrastructure/http/middlewares/validationMiddleware.ts`
6. Tests de seguridad

---

### Fase 13: Documentación y Testing Final (Semana 15)
#### Entregables:
1. Documentación OpenAPI/Swagger completa
2. Cobertura de tests >80%
3. Tests E2E completos en `tests/e2e/`
4. README detallado
5. Documentación de arquitectura en `docs/architecture.md`
6. Guía de setup y deployment

---

## Agentes de Desarrollo

### agente-domain
**Responsabilidad**: Capa de dominio (lógica de negocio pura)

**Herramientas**: TypeScript

**Tareas**:
- Definir entidades en `src/domain/entities/`
- Crear value objects en `src/domain/value-objects/`
- Implementar domain services puros en `src/domain/services/`
- Modelar eventos de dominio en `src/domain/events/`
- Definir errores de dominio en `src/domain/errors/`
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
- Implementar los 27 casos de uso en `src/application/use-cases/`
- Crear DTOs en `src/application/dto/`
- Definir puertos (interfaces) en `src/application/ports/`
- Orquestar llamadas a repositorios y servicios
- Validar reglas de negocio
- Publicar eventos de dominio
- Definir errores de aplicación en `src/application/errors/`
- Escribir tests unitarios con mocks de repositorios

**Referencias**:
- Casos de uso completos: `./Doc/casos-uso-completos.md`
- Análisis de requisitos: `./Doc/Analisis-de-requisitos-ListaCompra.pdf`

---

### agente-infrastructure-persistence
**Responsabilidad**: Persistencia de datos

**Herramientas**: PostgreSQL, Prisma, TypeScript

**Tareas**:
- Definir schema de Prisma en `src/infrastructure/persistence/prisma/schema.prisma`
- Implementar repositorios concretos en `src/infrastructure/persistence/repositories/`
- Crear mappers en `src/infrastructure/persistence/mappers/`
- Gestionar migraciones en `src/infrastructure/persistence/prisma/migrations/`
- Implementar tabla y lógica de Outbox
- Crear repositorios in-memory para testing en `src/infrastructure/persistence/in-memory/`
- Escribir tests de integración con base de datos

**Referencias**:
- Diagrama de clases: `./Doc/DiagramaClases_V1-mermaid.md`

---

### agente-infrastructure-messaging
**Responsabilidad**: Mensajería asíncrona y patrón Outbox

**Herramientas**: RabbitMQ, amqplib, TypeScript

**Tareas**:
- Configurar conexión en `src/infrastructure/messaging/rabbitmq/RabbitMQConnection.ts`
- Implementar publisher en `src/infrastructure/messaging/rabbitmq/RabbitMQPublisher.ts`
- Implementar consumers en `src/infrastructure/messaging/rabbitmq/RabbitMQConsumer.ts`
- Crear workers del Outbox en `src/infrastructure/messaging/outbox/`
- Implementar consumers específicos en `src/infrastructure/messaging/consumers/`
- Gestionar reintentos y dead letter queues
- Configuración en `src/infrastructure/config/rabbitmq.config.ts`
- Escribir tests de integración con RabbitMQ

**Referencias**:
- Casos de uso: CU-15, CU-19
- Análisis de requisitos (eventos): `./Doc/Analisis-de-requisitos-ListaCompra.pdf`

---

### agente-infrastructure-external
**Responsabilidad**: Servicios externos (IA, email, auth)

**Herramientas**: OpenAI API, Nodemailer, JWT, bcrypt, TypeScript

**Tareas**:
- Integrar APIs de IA en `src/infrastructure/external-services/ai/`
- Implementar servicio de emails en `src/infrastructure/external-services/email/`
- Implementar servicios de auth en `src/infrastructure/external-services/auth/`
- Gestionar timeouts y fallbacks
- Implementar caché de respuestas IA
- Configuración en `src/infrastructure/config/`
- Escribir tests con mocks de APIs externas

**Referencias**:
- Casos de uso: CU-01, CU-02, CU-19, CU-20, CU-21

---

### agente-infrastructure-http
**Responsabilidad**: API REST (controladores, rutas, middlewares)

**Herramientas**: Express/Fastify, TypeScript

**Tareas**:
- Crear controladores en `src/infrastructure/http/controllers/`
- Definir rutas en `src/infrastructure/http/routes/`
- Implementar middlewares en `src/infrastructure/http/middlewares/`
- Configurar servidor en `src/infrastructure/http/server.ts`
- Validar requests con Zod
- Gestionar respuestas HTTP y códigos de estado
- Escribir tests de integración (Supertest)

**Referencias**:
- Casos de uso completos: `./Doc/casos-uso-completos.md`

---

### agente-observability
**Responsabilidad**: Logging, metrics y tracing

**Herramientas**: Winston, Prometheus, OpenTelemetry, TypeScript

**Tareas**:
- Implementar logger en `src/infrastructure/observability/logger/`
- Configurar métricas en `src/infrastructure/observability/metrics/`
- Implementar tracing en `src/infrastructure/observability/tracing/`
- Integrar logging en toda la aplicación
- Crear dashboards de monitoreo
- Escribir tests de observabilidad

---

### agente-composition
**Responsabilidad**: Inversión de dependencias y composición raíz

**Herramientas**: TypeScript

**Tareas**:
- Crear contenedor de inyección de dependencias en `src/composition/container.ts`
- Registrar todas las dependencias (repositorios, servicios, casos de uso)
- Configurar ciclo de vida de dependencias
- Implementar factory patterns cuando sea necesario
- Escribir tests del contenedor

---

### agente-testing
**Responsabilidad**: Testing completo de la aplicación

**Herramientas**: Jest, Supertest, TypeScript

**Tareas**:
- Configurar Jest y cobertura
- Escribir tests unitarios en `tests/unit/`
- Escribir tests de integración en `tests/integration/`
- Escribir tests E2E en `tests/e2e/`
- Crear mocks, stubs y fakes necesarios
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
- Documentar arquitectura en `docs/architecture.md`
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
    "winston": "^3.11.0",
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
- Implementar **inyección de dependencias** mediante container en `src/composition/`
- Usar **puertos (interfaces)** en lugar de implementaciones concretas
- Documentar **decisiones arquitectónicas** importantes
- Crear **logs estructurados** para facilitar debugging
- Implementar **health checks** para monitoreo
- Usar **Result/Either** para manejo de errores funcional
- Mantener **inmutabilidad** en value objects
- Aplicar **mappers** para aislar capas de persistencia

Este roadmap está diseñado para cubrir todos los casos de uso definidos aplicando arquitectura limpia, SAGA/Outbox y buenas prácticas de desarrollo con una estructura de carpetas clara y escalable.
