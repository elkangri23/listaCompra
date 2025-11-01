# ♊ Perfil del Proyecto: Lista de la Compra Colaborativa

## Project Overview

Este es un sistema backend de nivel empresarial para una aplicación de "Lista de la Compra Colaborativa". Está construido con TypeScript y Node.js, siguiendo una **arquitectura hexagonal** para garantizar una clara separación de responsabilidades y una alta mantenibilidad.

El proyecto está diseñado para ser robusto, escalable y seguro, incorporando características avanzadas como:
- **Inteligencia Artificial**: Para la categorización de productos, generación de listas y recomendaciones, utilizando la API de Perplexity (Llama 3.1 Sonar).
- **Arquitectura Orientada a Eventos**: Utiliza RabbitMQ y el patrón Outbox para una comunicación asíncrona y fiable entre servicios.
- **Seguridad Avanzada**: Implementa autenticación JWT, control de acceso basado en roles (RBAC), limitación de velocidad (rate limiting) con Redis, y sanitización de entradas.
- **Notificaciones en Tiempo Real**: Sistema de notificaciones por email para invitaciones y otras acciones.
- **Persistencia de Datos**: Utiliza PostgreSQL como base de datos, con Prisma como ORM para un acceso a datos seguro y tipado.
- **Cache**: Redis se utiliza para cachear las respuestas de la IA y para el rate limiting.

El proyecto está muy bien documentado, con un fuerte enfoque en la calidad del código y las pruebas.

## Building and Running

### 1. Requisitos Previos
- Node.js (>=v20.0.0)
- npm (>=v10.0.0)
- Docker

### 2. Instalación
```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env
# (Editar .env con la configuración local)
```

### 3. Infraestructura (Docker)
```bash
# Levantar PostgreSQL, RabbitMQ y Redis
npm run docker:up

# Aplicar migraciones de la base de datos
npx prisma migrate dev

# (Opcional) Poblar la base de datos con datos de prueba
npm run prisma:seed
```

### 4. Ejecución de la Aplicación
```bash
# Modo desarrollo con hot-reload
npm run dev

# Build para producción
npm run build

# Iniciar en modo producción
npm start
```

### 5. Comandos de Testing
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

## Development Conventions

- **Arquitectura**: El código está estrictamente organizado siguiendo los principios de la **Arquitectura Hexagonal**, dividido en tres capas principales: `domain`, `application`, y `infrastructure`. Se aplican los principios SOLID.
- **Lenguaje**: **TypeScript** en modo estricto.
- **Estilo de Código**: Se utiliza **ESLint** para el linting y **Prettier** para el formateo del código. Los comandos `npm run lint` y `npm run format` están disponibles.
- **Pruebas (Testing)**: El framework de pruebas es **Jest**. El proyecto tiene una suite de tests muy completa, con una clara distinción entre:
    - **Tests Unitarios**: Cobertura del 100% para la lógica de dominio y aplicación.
    - **Tests de Integración**: Para verificar la correcta interacción con la base de datos y otros servicios.
    - **Tests E2E**: Flujos completos de la aplicación (actualmente necesitan trabajo).
- **Inyección de Dependencias**: Se utiliza un contenedor de inyección de dependencias (`src/composition/container.ts`) para ensamblar la aplicación.
- **Manejo de Errores**: Se utiliza un enfoque basado en `Result` para manejar operaciones que pueden fallar, separando los flujos de éxito y de error.
- **Commits y Contribuciones**: Se espera que las nuevas funcionalidades sigan las convenciones de código existentes y que incluyan los tests correspondientes.
