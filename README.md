# 🛒 Lista de la Compra Colaborativa

> **Sistema empresarial de gestión de listas colaborativas** con **arquitectura hexagonal**, **inteligencia artificial**, **notificaciones en tiempo real** y **seguridad de clase mundial**.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue.svg)](https://www.postgresql.org/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3.x-orange.svg)](https://www.rabbitmq.com/)
[![Security](https://img.shields.io/badge/Security-9.5%2F10-brightgreen.svg)](./ESTADO_PROYECTO.md)
[![Tests](https://img.shields.io/badge/Tests-495%2F543%20passing%20(91%25)-brightgreen.svg)](./ESTADO_PROYECTO.md)
[![Coverage](https://img.shields.io/badge/Coverage-18.94%25-yellow.svg)](./coverage/lcov-report/index.html)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🚀 **Descripción General**

Este es un sistema backend de nivel empresarial para una aplicación de "Lista de la Compra Colaborativa". Está construido con TypeScript y Node.js, siguiendo una **arquitectura hexagonal** para garantizar una clara separación de responsabilidades y una alta mantenibilidad.

Para un desglose detallado del estado actual, la arquitectura, los endpoints y las métricas, consulta el documento de estado del proyecto:

- 📖 **[Ver Estado Detallado del Proyecto](./ESTADO_PROYECTO.md)**

---

## ✨ **Características Principales**

- **🧠 Inteligencia Artificial**: Categorización de productos, generación de listas y recomendaciones (Llama 3.1 Sonar).
- **🏗️ Arquitectura Hexagonal**: Separación clara entre dominio, aplicación e infraestructura.
- **🛡️ Seguridad Avanzada**: JWT, RBAC, Rate Limiting (Redis), Input Sanitization.
- **🔔 Notificaciones en Tiempo Real**: Sistema de notificaciones por email para invitaciones y acciones.
- **📦 Arquitectura Orientada a Eventos**: RabbitMQ y patrón Outbox para comunicación asíncrona.
- **💾 Persistencia de Datos**: PostgreSQL con Prisma ORM.
- **⚡ Cache**: Redis para respuestas de IA y rate limiting.
- **📚 Documentación Interactiva**: Swagger/OpenAPI en `/api/docs`.

---

## 🛠️ **Stack Tecnológico**

- **Backend**: Node.js, Express, TypeScript
- **Base de Datos**: PostgreSQL, Prisma
- **Mensajería**: RabbitMQ
- **Cache**: Redis
- **IA**: Perplexity API (Llama 3.1 Sonar)
- **Testing**: Jest, Supertest
- **Seguridad**: bcrypt, jsonwebtoken, helmet

---

## ⚡ **Inicio Rápido**

### **1. Requisitos Previos**
- Node.js (>=v20.0.0)
- npm (>=v10.0.0)
- Docker

### **2. Instalación**
```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env
# (Editar .env con la configuración local)
```

### **3. Infraestructura (Docker)**
```bash
# Levantar PostgreSQL, RabbitMQ y Redis
npm run docker:up

# Aplicar migraciones de la base de datos
npx prisma migrate dev

# (Opcional) Poblar la base de datos con datos de prueba
npm run prisma:seed
```

### **4. Ejecución de la Aplicación**
```bash
# Modo desarrollo con hot-reload
npm run dev

# Build para producción
npm run build

# Iniciar en modo producción
npm start
```

### **5. Comandos de Testing**
```bash
# Ejecutar todos los tests
npm test

# Ejecutar solo los tests unitarios
npm run test:unit

# Generar reporte de cobertura
npm run test:cov

# Ejecutar tests en modo "watch"
npm run test:watch
```

---

## 📚 **Documentación**

Toda la documentación del proyecto está centralizada en el siguiente índice:

- 🗂️ **[Índice de Documentación](./DOCS_INDEX.md)**

Este índice contiene enlaces a:
- Análisis de requisitos
- Diagramas de arquitectura
- Casos de uso completos
- Guías de testing y contribución
- Y más...

---

## 🤝 **Contribuir**

Las contribuciones son bienvenidas. Por favor, sigue la [guía de contribución](./Docs/contribution-guide.md) para más detalles sobre cómo proponer cambios y seguir las convenciones del proyecto.

---

## 📄 **Licencia**

Este proyecto está bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.