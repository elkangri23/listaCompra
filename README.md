# 🛒 Lista de la Compra Colaborativa

> Proyecto educativo de backend desarrollado con **Node.js + TypeScript**, aplicando **arquitectura limpia (hexagonal)**, **patrón Outbox**, **mensajería asíncrona con RabbitMQ** e integración de **Inteligencia Artificial**.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue.svg)](https://www.postgresql.org/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3.x-orange.svg)](https://www.rabbitmq.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 📖 Tabla de Contenidos

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

## 📝 Descripción del Proyecto

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
| [`./Doc/Analisis-de-requisitos-ListaCompra.pdf`](./Doc/Analisis-de-requisitos-ListaCompra.pdf) | Análisis de requisitos funcionales y no funcionales completo |
| [`./Doc/DiagramaClases_V1-mermaid.md`](./Doc/DiagramaClases_V1-mermaid.md) | Diagrama de clases UML en formato Mermaid |
| [`./Doc/casos-uso-completos.md`](./Doc/casos-uso-completos.md) | 27 casos de uso detallados con flujos principales y alternativos |
| [`AGENTS-v2.md`](./AGENTS-v2.md) | Guía completa de arquitectura, roadmap y agentes de desarrollo |

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
- ✅ Notificaciones por email mediante eventos asíncronos

### Categorización
- ✅ Categorías/pasillos personalizables por usuario
- ✅ Categorías predefinidas por tienda
- ✅ Asociación opcional de productos a categorías

### Inteligencia Artificial
- ✅ Sugerencias de categorías por tienda mediante IA
- ✅ Análisis de hábitos de compra
- ✅ Integración con OpenAI/Gemini/Perplexity

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
┌─────────────────────────────────────────────────────┐
│                     ADAPTERS                        │
│  (HTTP Controllers, Routes, Middlewares)            │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│                  APPLICATION                        │
│  (Use Cases, DTOs, Ports/Interfaces)                │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│                    DOMAIN                           │
│  (Entities, Value Objects, Domain Services)         │
└─────────────────────────────────────────────────────┘
                     ▲
┌────────────────────┴────────────────────────────────┐
│                INFRASTRUCTURE                       │
│  (Repositories, RabbitMQ, Email, AI Services)       │
└─────────────────────────────────────────────────────┘
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

#### Mensajería
- **Broker**: RabbitMQ 3.x con Docker ✅
- **Cliente**: amqplib ✅
- **Patrón Outbox**: Implementado y funcionando ✅

#### Autenticación y Seguridad
- **Tokens**: JWT (jsonwebtoken) ✅
- **Encriptación**: bcrypt ✅
- **Arquitectura**: Event-driven con eventos de dominio ✅

#### Testing
- **Framework**: Jest con 149 tests pasando ✅
- **API Testing**: Supertest ✅
- **Cobertura**: >90% en capas core ✅

### ⏳ **Planificado para Fases Futuras**

#### Documentación y Observabilidad
- **API**: Swagger/OpenAPI (Fase 13)
- **Logging avanzado**: Winston (mejora pendiente)
- **Métricas**: Prometheus (Fase 12)
- **Tracing**: OpenTelemetry (Fase 12)

#### Servicios Externos
- **Email**: Nodemailer (Fase 8)
- **Seguridad HTTP**: Helmet (Fase 12)
- **Rate Limiting**: express-rate-limit (Fase 12)

#### Inteligencia Artificial
- **OpenAI API** (Fase 9)
- **Google Gemini** (Fase 9)
- **Perplexity AI** (Fase 9)
- **Azure OpenAI** (Fase 9)

### Testing
- **Framework**: Jest
- **API Testing**: Supertest
- **Cobertura**: >80%

### Calidad de Código
- **TypeScript**: Strict mode habilitado con `exactOptionalPropertyTypes`
- **Result Pattern**: Manejo funcional de errores implementado
- **Arquitectura Hexagonal**: Separación estricta de capas
- **Pre-commit**: Verificación de compilación TypeScript

### Documentación y Observabilidad
- **API**: Swagger/OpenAPI (planificado para Fase 13)
- **Logs**: Console logging estructurado (Winston planificado)
- **Observabilidad**: Métricas y tracing (planificado)

---

## 📋 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

- **Node.js** v20 o superior: [Descargar aquí](https://nodejs.org/)
- **npm** o **yarn**: Incluido con Node.js
- **Docker Desktop**: [Descargar aquí](https://www.docker.com/products/docker-desktop/) (para PostgreSQL y RabbitMQ)
- **Git**: [Descargar aquí](https://git-scm.com/)

---

## 🚀 Instalación y Configuración

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

Copia el archivo de ejemplo y configura tus valores:

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

## 📁 Estructura del Proyecto

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
│   │   ├── use-cases/               # 27 casos de uso organizados
│   │   ├── ports/                   # Interfaces (repositorios, servicios)
│   │   ├── dto/                     # DTOs entrada/salida
│   │   └── errors/                  # Errores de aplicación
│   │
│   ├── infrastructure/              # Adaptadores
│   │   ├── persistence/
│   │   │   ├── prisma/              # Schema y migraciones
│   │   │   ├── repositories/        # Implementaciones Prisma
│   │   │   ├── mappers/             # Mapeo entidad ↔ modelo
│   │   │   └── in-memory/           # Repositorios fake para testing
│   │   ├── http/
│   │   │   ├── controllers/         # Controladores REST
│   │   │   ├── middlewares/         # Auth, validación, errors
│   │   │   ├── routes/              # Definición de rutas
│   │   │   └── server.ts            # Bootstrap del servidor
│   │   ├── messaging/
│   │   │   ├── rabbitmq/            # Conexión, publisher, consumer
│   │   │   ├── outbox/              # Servicio outbox y worker
│   │   │   └── consumers/           # Consumers específicos
│   │   ├── external-services/
│   │   │   ├── ai/                  # OpenAI, Gemini, etc.
│   │   │   ├── email/               # Nodemailer
│   │   │   └── auth/                # JWT, bcrypt
│   │   ├── observability/           # Logger, metrics, tracing
│   │   └── config/                  # Configuración por módulo
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
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docs/                            # Documentación
│   ├── Analisis-de-requisitos-ListaCompra.pdf
│   ├── DiagramaClases_V1-mermaid.md
│   └── casos-uso-completos.md
│
├── .env.example
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── jest.config.js
├── AGENTS-v2.md
└── README.md
```

---

## 📝 Casos de Uso

El sistema implementa **27 casos de uso** completos organizados en módulos:

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

### Inteligencia Artificial (2)
- CU-20: Solicitar Sugerencias de IA para Categorías
- CU-21: Analizar Hábitos de Compra

### Blueprints/Plantillas (2)
- CU-22: Crear Blueprint
- CU-23: Usar Blueprint para Crear Lista

### Administración (2)
- CU-24: Impersonar Usuario
- CU-25: Finalizar Impersonación

### Auxiliares (2)
- CU-26: Obtener Tiendas Disponibles
- CU-27: Validar Enlaces de Invitación (Proceso Automático)

📄 **[Ver casos de uso detallados](./Doc/casos-uso-completos.md)**

---

## 🗓️ Estado del Proyecto - Progreso Actual

| Fase | Estado | Descripción | Casos de Uso |
|------|--------|-------------|--------------|
| **Fase 1** | ✅ **COMPLETADA** | Setup y arquitectura base | - |
| **Fase 2** | ✅ **COMPLETADA** | Autenticación y gestión de usuarios | CU-01, CU-02 |
| **Fase 3** | ✅ **COMPLETADA** | Gestión de listas | CU-03 a CU-06 |
| **Fase 4** | ✅ **COMPLETADA** | Gestión de productos | CU-07 a CU-10 |
| **Fase 5** | ✅ **COMPLETADA** | Gestión de categorías y tiendas | CU-11 a CU-14, CU-26 |
| **Fase 6** | ✅ **COMPLETADA** | Patrón Outbox y RabbitMQ | CU-19 (base) |
| **Fase 7** | 🔄 **EN DESARROLLO** | Compartición de listas | CU-15 a CU-18 |
| **Fase 8** | ⏳ **PENDIENTE** | Notificaciones por email | CU-19 (completo) |
| **Fase 9** | ⏳ **PENDIENTE** | Integración con IA | CU-20, CU-21 |
| **Fase 10** | ⏳ **PENDIENTE** | Blueprints/Plantillas | CU-22, CU-23 |
| **Fase 11** | ⏳ **PENDIENTE** | Funcionalidades de administrador | CU-24, CU-25 |
| **Fase 12** | ⏳ **PENDIENTE** | Validación y seguridad | CU-27 |
| **Fase 13** | ⏳ **PENDIENTE** | Documentación y testing final | - |

**Progreso:** 6/13 fases completadas **(46%)**  
**Tests:** 149/150 pasando **(99.3%)**  
**Arquitectura:** Hexagonal implementada ✅  
**Eventos:** Sistema robusto con Outbox pattern ✅

---

## 🗓️ Roadmap de Desarrollo

El proyecto se desarrolla en **13 fases** a lo largo de **15 semanas**:

| Fase | Duración | Descripción | Casos de Uso |
|------|----------|-------------|--------------|
| **Fase 1** | Semanas 1-2 | Setup y arquitectura base | - |
| **Fase 2** | Semana 3 | Autenticación y gestión de usuarios | CU-01, CU-02 |
| **Fase 3** | Semana 4 | Gestión de listas | CU-03 a CU-06 |
| **Fase 4** | Semana 5 | Gestión de productos | CU-07 a CU-10 |
| **Fase 5** | Semana 6 | Gestión de categorías y tiendas | CU-11 a CU-14, CU-26 |
| **Fase 6** | Semana 7 | Patrón Outbox y RabbitMQ | CU-19 |
| **Fase 7** | Semana 8 | Compartición de listas | CU-15 a CU-18 |
| **Fase 8** | Semana 9 | Notificaciones por email | CU-19 |
| **Fase 9** | Semanas 10-11 | Integración con IA | CU-20, CU-21 |
| **Fase 10** | Semana 12 | Blueprints/Plantillas | CU-22, CU-23 |
| **Fase 11** | Semana 13 | Funcionalidades de administrador | CU-24, CU-25 |
| **Fase 12** | Semana 14 | Validación y seguridad | CU-27 |
| **Fase 13** | Semana 15 | Documentación y testing final | - |

📄 **[Ver roadmap completo](./AGENTS-v2.md#roadmap-de-implementación)**

---

## 🧪 Testing

### Ejecutar tests

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

### Cobertura de Tests

El proyecto mantiene una cobertura mínima del **80%** en todas las capas:

- ✅ **Tests Unitarios**: Dominio y aplicación
- ✅ **Tests de Integración**: Repositorios, HTTP, mensajería
- ✅ **Tests E2E**: Flujos completos de usuario

---

## 📖 API Documentation

### Swagger UI

Una vez el servidor esté corriendo, accede a la documentación interactiva:

👉 **http://localhost:3000/api-docs**

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
POST   /api/ai/category-suggestions  # Obtener sugerencias de categorías
GET    /api/ai/habits-analysis       # Análisis de hábitos de compra
```

---

## 🤝 Contribución

Este es un proyecto educativo, pero las contribuciones son bienvenidas. Si deseas colaborar:

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

## 👤 Autor

Desarrollado como proyecto educativo del **Máster de Desarrollo con IA de Big School** (Brais Moure).

---

## 🙏 Agradecimientos

- [Big School](https://bigschool.dev/) y Brais Moure por el máster
- Comunidad de Node.js y TypeScript
- Autores de las librerías utilizadas

---

## 📞 Contacto y Soporte

- 📧 Email: anthonymoles@hotmail.com
- 💬 GitHub Issues: [Abrir issue](https://github.com/elkangri23/lista-compra-colaborativa/issues)
- 📚 Documentación adicional: Ver carpeta `./docs/`

---

## 🔗 Enlaces Útiles

- [Documentación de Node.js](https://nodejs.org/docs/)
- [Documentación de TypeScript](https://www.typescriptlang.org/docs/)
- [Documentación de Prisma](https://www.prisma.io/docs/)
- [Documentación de RabbitMQ](https://www.rabbitmq.com/documentation.html)
- [Clean Architecture (Uncle Bob)](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Arquitectura Hexagonal](https://alistair.cockburn.us/hexagonal-architecture/)

---

⭐ Si este proyecto te resultó útil, considera darle una estrella en GitHub
