# 🛒 Lista de la Compra Colaborativa

> Proyecto educativo de backend desarrollado con **Node.js + TypeScript**, aplicando **arquitectura limpia (hexagonal)**, **patrón Outbox**, **mensajería asíncrona con RabbitMQ** e integración de **Inteligencia Artificial**.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue.svg)](https://www.postgresql.org/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3.x-orange.svg)](https://www.rabbitmq.com/)
[![Security](https://img.shields.io/badge/Security-9.1%2F10-brightgreen.svg)](./ESTADO_PROYECTO.md)
[![Tests](https://img.shields.io/badge/Tests-416%2F416%20passing%20(100%25)-brightgreen.svg)](./MILESTONE_TESTING_100.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 Logros Recientes Completados (Octubre 2025)

> **🧠 FUNCIONALIDADES DE IA AVANZADA** - Sistema inteligente de categorización masiva y recomendaciones

### 🚀 **Fase 17: IA Premium - Categorización Masiva Inteligente (30 Oct 2025) - RECIÉN COMPLETADA** ⭐

- 📦 **Endpoint Bulk Categorization**: Procesamiento de hasta 50 productos por request
- 🎯 **Batching Automático**: División inteligente en lotes de 20 para optimizar tokens
- 🧠 **Prompt Engineering**: Contexto optimizado para Llama 3.1 Sonar (temp 0.3)
- 📊 **Enriquecimiento BD**: Integración automática con categorías existentes
- 💾 **Cache Redis 24h**: Reducción de costos API con TTL optimizado
- 🛡️ **3 Niveles Validación**: DTO (Zod), Use Case, Service Layer
- 📈 **Estadísticas Completas**: Confidence, sources, warnings, processing time
- ⚠️ **Manejo Fallos Parciales**: Continúa procesando aunque fallen productos
- 🔐 **Seguridad**: JWT + Rate Limiting específico para IA endpoints
- 📚 **Swagger Completo**: POST /api/v1/ai/bulk-categorize con ejemplos
- 💡 **UX Mejorada**: Onboarding rápido para usuarios con muchos productos

### 🧪 **Fase 16: IA Avanzada - Recomendaciones Contextuales (30 Oct 2025) - COMPLETADA** ✅

- 🎯 **3 Endpoints REST Funcionales**: Recomendaciones generales, específicas por producto, ejemplos
- 🧠 **IA con 3 niveles creatividad**: Conservative (0.3), Balanced (0.5), Creative (0.7) temperature
- ⭐ **Scoring inteligente 0-100**: Confidence con razones explicativas detalladas
- 🔍 **Filtros granulares avanzados**: Categoría, tienda, historial usuario, productos existentes
- 🎨 **Context-aware**: Interpreta "Cena romántica", "Desayuno fitness", "Barbacoa familiar"
- 🛡️ **15 reglas de fallback**: Patrones robustos (pasta→salsa, carne→papas)
- 📊 **Enriquecimiento local**: Categorías desde BD, precios estimados, cantidades sugeridas
- 💾 **Backend completo**: Use case (368 líneas), Controller (330+), Rutas Swagger (390+)
- 🎯 **TypeScript**: 0 errores compilación, integración DI Container
- 🔄 **4 tipos recomendación**: Complement, frequently_together, category_match, user_preference

### ✨ **Fase 15: Listas Inteligentes por Ocasión (29 Oct 2025) - RECIÉN COMPLETADA** ✅

- 🎯 **CU-32 Implementado**: Generación automática de listas completas con IA
- 🎉 **20 Ocasiones Predefinidas**: "Barbacoa", "Cena romántica", "Cumpleaños infantil", etc.
- 👥 **Parámetros Inteligentes**: Personas (1-50), presupuesto (1-10.000€), restricciones dietéticas
- 🧠 **Prompt Engineering**: IA optimizada para productos realistas con cantidades exactas
- 💰 **Estimación de Costos**: Cálculo automático de presupuesto total estimado
- 📦 **Categorización Automática**: Productos organizados por categorías de tienda
- 🔗 **3 endpoints REST**: Ocasiones predefinidas, generación y vista previa
- 📚 **Documentación Swagger**: Especificaciones completas con ejemplos interactivos

### 📚 **Fase 13: Documentación y Testing Final (29 Oct 2025) - COMPLETADA** ✅

- 🎯 **OpenAPI/Swagger UI** configurado: Documentación interactiva en `/api/docs`
- 📖 **47 endpoints documentados**: Especificaciones completas con ejemplos y esquemas
- 🏗️ **Schemas detallados**: Entidades de dominio (Usuario, Lista, Producto, Blueprint)
- 🔧 **Ejemplos interactivos**: Testing directo desde la UI de Swagger
- ⚙️ **Configuración modular**: `swagger-simple.config.ts` para fácil mantenimiento
- 📄 **JSON OpenAPI**: Especificación accesible en `/api/docs.json`
- 🏷️ **Tags organizados**: Endpoints categorizados por funcionalidad
- 🔐 **Autenticación JWT**: Integración completa Bearer token en documentación

### 🛡️ **Sistema de Seguridad Empresarial Implementado (29 Oct 2025)**

- 🔑 **API Key Protection**: Validación robusta + logging seguro para Perplexity API
- 👮 **Admin Role Validation**: Multi-capa, prevención escalación privilegios
- 🧹 **Blueprint Sanitization**: XSS/injection protection con BlueprintSanitizer
- 🚦 **AI Rate Limiting**: Control granular per-user (5 req/min, 50/día)
- 🎯 **Prompt Injection Protection**: AISecurityUtils con 20+ patrones detectados
- 📊 **Score Seguridad**: **9.1/10** (subió desde 7.2/10)
- ✅ **0 vulnerabilidades críticas** restantes - Sistema producción-ready

### 🔒 **Fase 2: Seguridad Empresarial Avanzada (29 Oct 2025) - COMPLETADA** ✅

- 📋 **SecurityAuditService** (600+ líneas): Sistema de auditoría empresarial con 20+ tipos
- 🔐 **BlueprintPrivacyMiddleware** (240+ líneas): Control de acceso multicapa
- 🔍 **CacheIntegrityService** (500+ líneas): Validación de integridad con checksums
- 🛡️ **InputSanitizationService** (600+ líneas): Protección avanzada contra OWASP Top 10
- ⚡ **AdvancedRateLimitService** (600+ líneas): Rate limiting adaptativo
- 👨‍💼 **Administración de Cache** (300+ líneas): Endpoints admin para monitoreo
- 📊 **Total**: **2,500+ líneas** de código de seguridad empresarial
- ✅ **Estado**: Sistema preparado para entornos de producción enterprise

### ⚡ **Optimización de Performance Completada (Octubre 2025)**

- ⏱️ **Tests optimizados**: -83% tiempo tests integración (122s → 21s)
- 📧 **Email mocking**: Tests SMTP deshabilitados por defecto, eliminados timeouts
- 🔄 **Jest paralelización**: maxWorkers 50% configurado para desarrollo ágil
- 📊 **Sistema de métricas**: MetricsCollector en tiempo real para todos endpoints
- 🐛 **Database isolation**: Race conditions corregidas, emails únicos en tests
- 📈 **Throughput mejorado**: +785% en velocidad de ejecución de tests
- 🎭 **MockNodemailerService**: Sistema de mocks completo para desarrollo
- 📖 **Documentación actualizada**: PERFORMANCE_ANALYSIS.md con métricas detalladas

---

## 📑 Tabla de Contenidos

- [Descripción del Proyecto](#-descripción-del-proyecto)
- [Documentación](#-documentación)
- [Características Principales](#-características-principales)
- [Arquitectura](#-arquitectura)
- [Stack Tecnológico](#-stack-tecnológico)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación y Configuración](#-instalación-y-configuración)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Casos de Uso](#-casos-de-uso)
- [Roadmap de Desarrollo](#-roadmap-de-desarrollo)
- [Testing](#-testing)
- [API Documentation](#-api-documentation)
- [Contribución](#-contribución)
- [Licencia](#-licencia)

---

## 📋 Descripción del Proyecto

Sistema backend de gestión de **listas de compra colaborativas** que permite a los usuarios:

- Crear y gestionar listas de compra asociadas a tiendas específicas
- Compartir listas con otros usuarios mediante enlaces seguros
- Organizar productos por categorías/pasillos personalizables
- Recibir sugerencias inteligentes mediante IA
- Analizar patrones y hábitos de compra

El proyecto es un ejercicio educativo avanzado desarrollado como parte del **Máster de Desarrollo con IA de Big School** (Brais Moure), enfocado en la aplicación práctica de:

- Arquitectura limpia y hexagonal
- Principios SOLID
- Patrón Outbox para consistencia eventual
- Mensajería asíncrona con RabbitMQ
- Integración de APIs de Inteligencia Artificial
- Testing exhaustivo (unitario, integración, E2E)

---

## 📚 Documentación

| Documento | Descripción |
|-----------|-------------|
| [Analisis-de-requisitos-ListaCompra.pdf](Doc/Analisis-de-requisitos-ListaCompra.pdf) | Análisis de requisitos funcionales y no funcionales completo |
| [DiagramaClases_V1-mermaid.md](Doc/DiagramaClases_V1-mermaid.md) | Diagrama de clases UML en formato Mermaid |
| [casos-uso-completos.md](Doc/casos-uso-completos.md) | 33 casos de uso detallados con flujos principales y alternativos |
| [AGENTS.md](AGENTS.md) | Guía completa de arquitectura, roadmap y agentes de desarrollo |
| [API_Testing_Guide.md](API_Testing_Guide.md) | Guía de testing con Postman/Thunder Client |
| [TERMS_AND_CONDITIONS.md](TERMS_AND_CONDITIONS.md) | Términos y Condiciones del Servicio |
| [PRIVACY_POLICY.md](PRIVACY_POLICY.md) | Política de Privacidad y Protección de Datos |

---

## 🧪 Testing de API

Para probar todos los endpoints de la API fácilmente:

| Archivo | Herramienta | Descripción |
|---------|-------------|-------------|
| [postman_collection.json](postman_collection.json) | Postman/Thunder Client | **33+ endpoints** organizados en 7 categorías |
| [postman_environment.json](postman_environment.json) | Postman/Thunder Client | Variables de entorno para desarrollo local |
| [API_Testing_Guide.md](API_Testing_Guide.md) | Documentación | **Guía completa** con flujos de testing |

### 🚀 Inicio Rápido de Testing

1. **Importa** `postman_collection.json` en Postman/Thunder Client
2. **Configura** el entorno con `postman_environment.json`
3. **Sigue** la guía en [API_Testing_Guide.md](API_Testing_Guide.md)
4. **Ejecuta** el flujo: Registro → Login → Crear Lista → Agregar Productos

---

## ✨ Características Principales

### Gestión de Usuarios

- ✅ Registro y autenticación con JWT
- ✅ Roles diferenciados (Usuario Normal, Invitado, Administrador)
- ✅ Encriptación segura de contraseñas (bcrypt)

### Gestión de Listas

- ✅ CRUD completo de listas de compra
- ✅ Asociación de listas a tiendas específicas
- ✅ Marcar productos como comprados
- ✅ Creación de blueprints/plantillas reutilizables

### Colaboración

- ✅ Compartir listas mediante enlaces seguros con hash criptográfico
- ✅ Permisos granulares (lectura / lectura-escritura)
- ✅ Acceso de invitados sin necesidad de registro
- ✅ **Sistema de notificaciones por email** implementado
- ✅ **Eventos asíncronos** para invitaciones mediante RabbitMQ
- ✅ **Plantillas HTML responsivas** para emails de invitación

### Categorización

- ✅ Categorías/pasillos personalizables por usuario
- ✅ Categorías predefinidas por tienda
- ✅ Asociación opcional de productos a categorías

### 🤖 Inteligencia Artificial (IA)

#### **Fase 9: IA Básica - Categorización Automática** ✅ **COMPLETADA**

- 🧠 **CU-28: Sugerencias Automáticas de Categorías por Tienda**
  - Categorización inteligente basada en contexto de tienda específica
  - Aplicación automática sin confirmación para fluidez
  - Integración con **Perplexity AI** (modelo Llama 3.1 Sonar)
  - Cache inteligente para optimizar costos

#### **Fase 15: IA Premium - Listas Inteligentes por Ocasión** ✅ **COMPLETADA (29 Oct)**

- 🎯 **CU-32: Generador de Listas por Ocasión**
  - 20 ocasiones predefinidas: "Barbacoa", "Cena romántica", "Desayuno fitness", etc.
  - Control de presupuesto (1-10.000€) y escalado personas (1-50)
  - Restricciones dietéticas personalizables (máx 10)
  - Prompt engineering optimizado para Llama 3.1 Sonar
  - Métricas de confianza y validación robusta

#### **Fase 16: IA Avanzada - Recomendaciones Contextuales** ✅ **COMPLETADA (30 Oct)**

- 🧠 **CU-33: Recomendaciones Inteligentes de Productos**
  - **3 Endpoints REST**: Recomendaciones generales, específicas, ejemplos de contexto
  - **3 niveles de creatividad**: Conservative (0.3), Balanced (0.5), Creative (0.7)
  - **Scoring de confianza**: 0-100 con razones explicativas
  - **Filtros avanzados**: Por categoría, tienda, historial, productos existentes
  - **Context-aware**: Interpreta contextos complejos
  - **Fallbacks robustos**: 15 reglas basadas en patrones
  - **Enriquecimiento local**: Categorías desde BD, precios, cantidades
  - **4 tipos de recomendación**: Complement, frequently_together, category_match, user_preference

**📡 Endpoints CU-33:**

```bash
# Recomendaciones generales para una lista
GET /api/v1/recommendations/:listId
  ?creativityLevel=balanced
  &maxRecommendations=10
  &excludeExisting=true

# Recomendaciones específicas basadas en producto
GET /api/v1/recommendations/:listId/for-product/:productId
  ?context=Cena%20italiana

# Ejemplos de contextos disponibles (público)
GET /api/v1/recommendations/context-examples
```

**📊 Parámetros opcionales:**

- `maxRecommendations` (5-50, default: 10)
- `creativityLevel` (conservative/balanced/creative)
- `categoryId` - Filtrar por categoría
- `storeId` - Filtrar por tienda
- `context` - Contexto textual
- `includeUserHistory` (boolean)
- `excludeExisting` (boolean, default: true)

**📋 Respuesta típica:**

```json
{
  "success": true,
  "data": {
    "listId": "abc123",
    "recommendations": [
      {
        "name": "Salsa de tomate",
        "reason": "Complementa perfectamente con la pasta",
        "confidenceScore": 92,
        "suggestedCategory": {"id": "cat456", "name": "Salsas"},
        "estimatedPrice": 2.5,
        "suggestedQuantity": 1,
        "recommendationType": "complement"
      }
    ],
    "detectedContext": "Comida italiana casual",
    "metadata": {
      "processingTime": 1250,
      "aiUsed": true,
      "averageConfidence": 87.3
    }
  }
}
```

### Administración

- ✅ Impersonación de usuarios para testing
- ✅ Logs de auditoría
- ✅ Gestión de permisos y roles

---

## 🏗️ Arquitectura

El proyecto sigue los principios de **Clean Architecture** y **Arquitectura Hexagonal**, garantizando:

- **Independencia del framework**: La lógica de negocio no depende de Express/Fastify
- **Independencia de la base de datos**: Se puede cambiar PostgreSQL sin afectar el dominio
- **Independencia de servicios externos**: IA y email son intercambiables
- **Testeable**: Cada capa puede probarse de forma aislada
- **Mantenible**: Separación clara de responsabilidades

### Capas de la Arquitectura

```
+-----------------------------------------------------+
│                     ADAPTERS                        │
│  (HTTP Controllers, Routes, Middlewares)            │
+-----------------------------------------------------+
                     ↑
+-----------------------------------------------------+
│                  APPLICATION                        │
│  (Use Cases, DTOs, Ports/Interfaces)                │
+-----------------------------------------------------+
                     ↑
+-----------------------------------------------------+
│                    DOMAIN                           │
│  (Entities, Value Objects, Domain Services)         │
+-----------------------------------------------------+
                     ↑
+-----------------------------------------------------+
│                INFRASTRUCTURE                       │
│  (Repositories, RabbitMQ, Email, AI Services)       │
+-----------------------------------------------------+
```

### Patrón Outbox

Implementa consistencia eventual mediante:

1. **Outbox Table**: Almacena eventos de dominio en la misma transacción
2. **Worker/Poller**: Procesa eventos pendientes de forma asíncrona
3. **RabbitMQ**: Publica eventos a consumers externos
4. **Consumers**: Procesan eventos (notificaciones, auditoría, etc.)

---

## 🛠️ Stack Tecnológico - Estado Real

### ✅ **Implementado y Funcionando**

#### Backend

- **Runtime**: Node.js v16.17.0+ ✅
- **Lenguaje**: TypeScript 5.x ✅
- **Framework Web**: Express ✅
- **Validación**: Zod ✅

#### Persistencia

- **Base de datos**: PostgreSQL 15+ con Docker ✅
- **ORM**: Prisma 5.x ✅
- **Migraciones**: Prisma Migrate ✅

#### Mensajería y Notificaciones

- **Broker**: RabbitMQ 3.x con Docker ✅
- **Cliente**: amqplib ✅
- **Patrón Outbox**: Implementado y funcionando ✅
- **Email Service**: NodemailerService con Gmail/SMTP ✅
- **RabbitMQConsumer**: Consumer base genérico ✅
- **NotificationConsumer**: Consumer específico para eventos ✅
- **WorkerService**: Gestión limpia de consumers ✅
- **Plantillas HTML**: Emails responsivos integrados ✅

#### Inteligencia Artificial y Cache

- **IA Service**: Perplexity API con Llama 3.1 Sonar ✅
- **Cache Redis**: Sistema TTL inteligente ✅
- **Categorización automática**: Productos con confianza >= 0.7 ✅
- **Rate Limiting**: 10 req/min con fallback graceful ✅
- **CacheService**: Redis con gestión de conexiones ✅

#### Autenticación y Seguridad

- **Tokens**: JWT (jsonwebtoken) ✅
- **Encriptación**: bcrypt ✅
- **Hash seguro**: Para invitaciones ✅
- **SecurityAuditService**: Sistema de auditoría empresarial ✅
- **BlueprintPrivacyMiddleware**: Control de acceso multicapa ✅
- **CacheIntegrityService**: Validación de integridad ✅
- **InputSanitizationService**: Protección OWASP Top 10 ✅
- **AdvancedRateLimitService**: Rate limiting adaptativo ✅

#### Testing

- **Framework**: Jest con 243 tests pasando ✅
- **API Testing**: Supertest ✅
- **Cobertura**: >90% en capas core ✅
- **Email Testing**: Scripts de configuración ✅

---

## 📋 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

- **Node.js** v20 o superior: [Descargar aquí](https://nodejs.org/)
- **npm** o **yarn**: Incluido con Node.js
- **Docker Desktop**: [Descargar aquí](https://www.docker.com/products/docker-desktop/)
- **Git**: [Descargar aquí](https://git-scm.com/)

---

## 📦 Instalación y Configuración

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/lista-compra-colaborativa.git
cd lista-compra-colaborativa
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Levantar servicios con Docker

#### PostgreSQL

```bash
docker run -d \
  --name postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=lista_compra \
  -p 5432:5432 \
  -v ./postgres-data:/var/lib/postgresql/data \
  postgres:15
```

#### RabbitMQ

```bash
docker run -d \
  --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  rabbitmq:management
```

**Panel de administración RabbitMQ**: http://localhost:15672 (guest/guest)

### 4. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env`:

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/lista_compra

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# JWT
JWT_SECRET=tu_secreto_super_seguro
JWT_EXPIRATION=24h

# API Server
PORT=3000
NODE_ENV=development

# OpenAI (opcional)
OPENAI_API_KEY=tu_api_key_aqui

# Email (opcional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_email@gmail.com
SMTP_PASS=tu_contraseña
```

### 5. Generar Prisma Client y ejecutar migraciones

```bash
npx prisma generate
npx prisma migrate dev
```

### 6. (Opcional) Poblar datos iniciales

```bash
npx prisma db seed
```

### 7. Iniciar el servidor

```bash
# Modo desarrollo (con hot reload)
npm run dev

# Modo producción
npm run build
npm start
```

El servidor estará disponible en: **http://localhost:3000**

---

## 📂 Estructura del Proyecto

```
/
├── src/
│   ├── domain/                      # Lógica de negocio pura
│   │   ├── entities/                # Usuario, Lista, Producto, etc.
│   │   ├── value-objects/           # Email, Password, Hash
│   │   ├── services/                # Domain services
│   │   ├── events/                  # Eventos de dominio
│   │   └── errors/                  # Errores de dominio
│   │
│   ├── application/                 # Casos de uso
│   │   ├── use-cases/               # 33 casos de uso organizados
│   │   ├── ports/                   # Interfaces (repositorios, servicios)
│   │   ├── dto/                     # DTOs entrada/salida
│   │   └── errors/                  # Errores de aplicación
│   │
│   ├── infrastructure/              # Adaptadores
│   │   ├── persistence/
│   │   │   ├── prisma/              # Schema y migraciones
│   │   │   ├── repositories/        # Implementaciones Prisma
│   │   │   ├── mappers/             # Mapeo entidad → modelo
│   │   │   └── in-memory/           # Repositorios fake para testing
│   │   ├── http/
│   │   │   ├── controllers/         # Controladores REST
│   │   │   │   ├── AuthController.ts
│   │   │   │   ├── ListController.ts
│   │   │   │   ├── ProductController.ts
│   │   │   │   ├── CategoryController.ts
│   │   │   │   ├── InvitationController.ts
│   │   │   │   ├── AIController.ts
│   │   │   │   ├── BlueprintController.ts
│   │   │   │   ├── AdminController.ts
│   │   │   │   ├── DashboardController.ts
│   │   │   │   └── CacheIntegrityController.ts
│   │   │   ├── middlewares/         # Auth, validación, errors
│   │   │   ├── routes/              # Definición de rutas
│   │   │   └── server.ts            # Bootstrap del servidor
│   │   ├── messaging/
│   │   │   ├── rabbitmq/            # Conexión, publisher, consumer
│   │   │   ├── outbox/              # Servicio outbox y worker
│   │   │   └── consumers/           # Consumers específicos
│   │   ├── external-services/
│   │   │   ├── ai/                  # Perplexity AI, OpenAI
│   │   │   ├── email/               # Nodemailer
│   │   │   ├── auth/                # JWT, bcrypt
│   │   │   └── security/            # Servicios de seguridad empresarial
│   │   └── observability/           # Logger, metrics, tracing
│   │
│   ├── composition/                 # Inyección de dependencias
│   │   └── container.ts
│   │
│   ├── shared/                      # Utilidades compartidas
│   │   ├── result.ts                # Result/Either
│   │   ├── types.ts
│   │   └── utils.ts
│   │
│   └── main.ts                      # Punto de entrada
│
├── tests/
│   ├── unit/                        # Tests unitarios
│   │   ├── domain/
│   │   ├── application/
│   │   └── infrastructure/
│   ├── integration/                 # Tests de integración
│   ├── e2e/                         # Tests end-to-end
│   └── setup.ts                     # Configuración global
│
├── scripts/                         # Scripts auxiliares
├── docker/                          # Configuraciones Docker
├── prisma/                          # Prisma ORM
├── docs/                            # Documentación
├── .env.example                     # Plantilla de variables
├── tsconfig.json                    # Configuración TypeScript
├── jest.config.js                   # Configuración Jest
├── docker-compose.yml               # Docker Compose
└── README.md                        # Este archivo
```

---

## 🎯 Casos de Uso

El sistema implementa **33 casos de uso** completos organizados en módulos:

### Autenticación (2)
- CU-01: Registro de Usuario
- CU-02: Autenticación de Usuario

### Gestión de Listas (4)
- CU-03: Crear Lista de la Compra
- CU-04: Obtener Listas del Usuario
- CU-05: Actualizar Lista
- CU-06: Eliminar Lista

### Gestión de Productos (4)
- CU-07: Agregar Producto a Lista
- CU-08: Marcar/Desmarcar Producto como Comprado
- CU-09: Modificar Producto
- CU-10: Eliminar Producto

### Gestión de Categorías (4)
- CU-11: Crear Categoría
- CU-12: Obtener Categorías de Tienda
- CU-13: Actualizar Categoría
- CU-14: Eliminar Categoría

### Compartición y Colaboración (4)
- CU-15: Compartir Lista (Generar Enlace)
- CU-16: Acceder a Lista Compartida
- CU-17: Gestionar Permisos
- CU-18: Cancelar Invitación

### Notificaciones (1)
- CU-19: Procesar Notificación (Worker Outbox)

### 🤖 IA Básica - Fase 9 (1)
- **CU-28: Sugerencias Automáticas de Categorías por Tienda**

### Blueprints/Plantillas (2)
- CU-22: Crear Blueprint
- CU-23: Usar Blueprint para Crear Lista

### Administración (2)
- CU-24: Impersonar Usuario
- CU-25: Finalizar Impersonación

### Auxiliares (2)
- CU-26: Obtener Tiendas Disponibles
- CU-27: Validar Enlaces de Invitación

### 🧠 IA Avanzada - Fase Extra (5)
- **CU-29: Categorización Masiva Inteligente**
- **CU-30: Análisis Inteligente de Hábitos de Compra**
- **CU-31: Alertas Proactivas de Precios y Ofertas**
- **CU-32: Listas Inteligentes por Ocasión**
- **CU-33: Recomendaciones Contextuales Automáticas**

📖 **[Ver casos de uso detallados](Doc/casos-uso-completos.md)**

---

## 🚀 Roadmap de Desarrollo

| Fase | Estado | Descripción | Casos de Uso |
|------|--------|-------------|--------------|
| **Fase 1** | ✅ **COMPLETADA** | Setup y arquitectura base | - |
| **Fase 2** | ✅ **COMPLETADA** | Autenticación y gestión | CU-01, CU-02 |
| **Fase 3** | ✅ **COMPLETADA** | Gestión de listas | CU-03 a CU-06 |
| **Fase 4** | ✅ **COMPLETADA** | Gestión de productos | CU-07 a CU-10 |
| **Fase 5** | ✅ **COMPLETADA** | Categorías y tiendas | CU-11 a CU-14 |
| **Fase 6** | ✅ **COMPLETADA** | Patrón Outbox y RabbitMQ | CU-19 |
| **Fase 7** | ✅ **COMPLETADA** | Compartición de listas | CU-15 a CU-18 |
| **Fase 8** | ✅ **COMPLETADA** | Notificaciones email | CU-19 |
| **Fase 9** | ✅ **COMPLETADA** | IA Básica | CU-28 |
| **Fase 10** | ✅ **COMPLETADA** | Blueprints | CU-22, CU-23 |
| **Fase 11** | ✅ **COMPLETADA** | Administrador | CU-24, CU-25 |
| **Fase 12** | ✅ **COMPLETADA** | Validación | CU-27 |
| **Fase 13** | ✅ **COMPLETADA** | Documentación | Swagger |
| **Fase 14** | ✅ **COMPLETADA** | IA Premium | CU-32 |
| **Fase Extra** | ⏳ **FUTURO** | IA Avanzada | CU-29, CU-30, CU-31, CU-33 |

**Progreso:** 14/15 fases completadas **(93%)**

---

## 🧪 Testing

### 🧪 Testing de API (Postman/Thunder Client)

**¡Prueba todos los endpoints fácilmente!**

📁 **Archivos disponibles**:
- [postman_collection.json](postman_collection.json) - Colección completa (33+ endpoints)
- [postman_environment.json](postman_environment.json) - Variables de entorno
- [API_Testing_Guide.md](API_Testing_Guide.md) - Guía detallada

🚀 **Inicio rápido**: Importa la colección → Configura entorno → Sigue la guía

### 🤖 Testing Automatizado

```bash
# Todos los tests
npm run test

# Tests en modo watch
npm run test:watch

# Tests con cobertura
npm run test:cov

# Solo tests unitarios
npm run test:unit

# Solo tests de integración
npm run test:integration

# Solo tests E2E
npm run test:e2e
```

### 📊 Cobertura de Tests

El proyecto mantiene una cobertura mínima del **80%** en todas las capas:

- ✅ **Tests Unitarios** (150+ tests): Dominio completo
- ✅ **Tests de Integración** (44+ tests): Repositorios y BD
- 🔄 **Tests E2E**: Flujos completos de usuario

**Estado Actual:** **380+ tests pasando** ✅

---

## 📚 API Documentation

### Swagger UI

Una vez el servidor esté corriendo, accede a la documentación interactiva:

🔗 **http://localhost:3000/api-docs**

### Endpoints Principales

#### Autenticación
```
POST   /api/auth/register          # Registrar usuario
POST   /api/auth/login             # Iniciar sesión
```

#### Listas
```
GET    /api/lists                  # Obtener listas del usuario
POST   /api/lists                  # Crear lista
GET    /api/lists/:id              # Obtener lista específica
PUT    /api/lists/:id              # Actualizar lista
DELETE /api/lists/:id              # Eliminar lista
POST   /api/lists/:id/share        # Compartir lista
```

#### Productos
```
POST   /api/lists/:id/products     # Añadir producto a lista
PATCH  /api/products/:id/purchased # Marcar como comprado
PUT    /api/products/:id           # Actualizar producto
DELETE /api/products/:id           # Eliminar producto
```

#### Categorías
```
GET    /api/stores/:id/categories  # Obtener categorías de tienda
POST   /api/categories             # Crear categoría
PUT    /api/categories/:id         # Actualizar categoría
DELETE /api/categories/:id         # Eliminar categoría
```

#### IA
```
POST   /api/ai/category-suggestions  # Obtener sugerencias
GET    /api/ai/habits-analysis       # Análisis de hábitos
```

#### Dashboard
```
GET    /api/dashboard/metrics        # Métricas del sistema
GET    /api/dashboard/health         # Estado de salud
GET    /api/dashboard/alerts         # Alertas activas
GET    /api/dashboard/performance    # Análisis performance
```

---

## 🤝 Contribución

Este es un proyecto educativo, pero las contribuciones son bienvenidas:

1. Haz un fork del proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commitea tus cambios (`git commit -am 'Añade nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

### Guías de Contribución

- Sigue los principios SOLID
- Escribe tests para todo código nuevo
- Mantén la cobertura >80%
- Documenta las funciones públicas
- Usa TypeScript strict mode
- Verifica que compila sin errores antes de commitear

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

---

## 👨‍💻 Autor

Desarrollado como proyecto educativo del **Máster de Desarrollo con IA de Big School** (Brais Moure).

---

## 🙏 Agradecimientos

- [Big School](https://bigschool.dev/) y Brais Moure por el máster
- Comunidad de Node.js y TypeScript
- Autores de las librerías utilizadas

---

## 📧 Contacto y Soporte

- 📧 Email: email-privado-eliminado@example.invalid
- 🐛 GitHub Issues: [Abrir issue](https://github.com/elkangri23/lista-compra-colaborativa/issues)
- 📖 Documentación adicional: Ver carpeta `docs/`

---

## 🔗 Enlaces Útiles

- [Documentación de Node.js](https://nodejs.org/docs/)
- [Documentación de TypeScript](https://www.typescriptlang.org/docs/)
- [Documentación de Prisma](https://www.prisma.io/docs/)
- [Documentación de RabbitMQ](https://www.rabbitmq.com/documentation.html)
- [Clean Architecture (Uncle Bob)](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Arquitectura Hexagonal](https://alistair.cockburn.us/hexagonal-architecture/)

---

⭐ **Si este proyecto te resultó útil, considera darle una estrella en GitHub**
