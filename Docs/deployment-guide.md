# Guía de Despliegue Avanzado

## Tabla de Contenidos
1. [Visión General](#visión-general)
2. [Arquitectura de Entornos](#arquitectura-de-entornos)
3. [Requisitos Previos](#requisitos-previos)
4. [Variables de Entorno](#variables-de-entorno)
5. [Despliegue Local](#despliegue-local)
6. [Despliegue Staging](#despliegue-staging)
7. [Despliegue Producción](#despliegue-producción)
8. [Migraciones de Base de Datos](#migraciones-de-base-de-datos)
9. [Observabilidad y Monitoreo](#observabilidad-y-monitoreo)
10. [Procedimientos de Recuperación](#procedimientos-de-recuperación)
11. [Checklist de Publicación](#checklist-de-publicación)

---

## Visión General
Esta guía describe el ciclo completo de despliegue de la plataforma **ListaCompra**, abarcando entornos locales, staging y producción. El objetivo es garantizar entregas repetibles, seguras y trazables, alineadas con la arquitectura hexagonal y los requisitos de auditoría.

---

## Arquitectura de Entornos
| Entorno   | Propósito                               | Infraestructura                             |
|-----------|-----------------------------------------|----------------------------------------------|
| Local     | Desarrollo diario y pruebas unitarias   | Docker Compose (PostgreSQL, Redis, RabbitMQ) |
| Staging   | Validación previa al release            | Kubernetes (namespace `staging`)             |
| Producción| Uso real por clientes y métricas finales| Kubernetes (namespace `production`)          |

- **Canalización CI/CD**: GitHub Actions → Build & Test → Push imágenes a registry → Deploy con Helm.
- **Control de versiones**: Etiquetas semánticas `vX.Y.Z` generadas en cada despliegue de producción.

---

## Requisitos Previos
1. **Credenciales**: Acceso a GitHub Packages, cluster Kubernetes y gestor de secretos.
2. **Herramientas**:
   - Docker >= 24
   - Node.js 20 LTS
   - Helm 3.14+
   - kubectl 1.30+
   - Terraform (opcional para IaC)
3. **Permisos**: Rol `devops` para staging y `release-manager` para producción.

---

## Variables de Entorno
Gestionadas mediante `.env` (local) y **Secretos** en vault para entornos remotos.

| Variable                | Descripción                                 | Entorno |
|-------------------------|---------------------------------------------|---------|
| `DATABASE_URL`          | Cadena de conexión PostgreSQL               | Todos   |
| `REDIS_URL`             | Servidor Redis para cache IA                | Todos   |
| `RABBITMQ_URL`          | Broker de eventos para outbox               | Stg/Prod|
| `JWT_SECRET`            | Secreto de firma JWT                        | Todos   |
| `PPLX_API_KEY`          | API Key de Perplexity                       | Todos   |
| `S3_BUCKET`             | Bucket para adjuntos/documentos             | Prod    |
| `HEALTHCHECK_TOKEN`     | Token de autenticación para healthchecks    | Prod    |

> **Nota**: Mantener versiones versionadas de los secretos mediante `sops` o `sealed-secrets`.

---

## Despliegue Local
1. Clonar repositorio y ejecutar `npm install`.
2. Levantar dependencias con `docker-compose up -d`.
3. Generar artefactos Prisma:
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   npx prisma db seed
   ```
4. Arrancar servidor en modo desarrollo:
   ```bash
   npm run dev
   ```
5. Ejecutar suites de testing (`npm run test`).

---

## Despliegue Staging
1. **Build**: `npm run build` y `docker build -t registry/listacompra:$TAG .`.
2. **Push**: Autenticarse y publicar la imagen.
3. **Helm**: Actualizar valores en `helm/staging/values.yaml` (imagen, variables).
4. **Deploy**:
   ```bash
   helm upgrade --install listacompra-stg helm/chart \
     --namespace staging \
     --values helm/staging/values.yaml
   ```
5. **Post-deploy**:
   - Ejecutar migraciones con `npm run prisma:migrate -- --schema prisma/schema.prisma` vía job temporal.
   - Validar healthchecks (`/health`, `/ready`).
   - Lanzar smoke tests (`npm run test:smoke`).

---

## Despliegue Producción
1. Crear release branch `release/x.y.z`.
2. Asegurar aprobación QA + Product Owner.
3. Ejecutar pipeline `deploy-production` (GitHub Actions) con parámetros:
   - `tag`: versión semántica.
   - `env`: `production`.
4. Pipeline ejecuta:
   - Tests unitarios, integración y E2E.
   - Build & push de imagen.
   - Despliegue Helm en namespace `production`.
   - Ejecución de migraciones con `kubectl job` controlado.
5. Confirmar monitoreo (ver sección Observabilidad).

> **Rollback**: Helm `history` y `rollback`, seguido de restauración de base de datos desde snapshot (ver Recuperación).

---

## Migraciones de Base de Datos
- Todas las migraciones Prisma deben revisarse en PR.
- En producción, ejecutar desde job dedicado:
  ```bash
  kubectl apply -f k8s/jobs/prisma-migrate.yaml
  kubectl logs job/prisma-migrate
  kubectl delete job prisma-migrate
  ```
- Mantener backups incrementales cada 6h y full diario utilizando `pgBackRest`.

---

## Observabilidad y Monitoreo
- **Logging**: JSON estructurado vía Winston → Loki.
- **Métricas**: Prometheus + Grafana (dashboards `listacompra-api`, `queue-latency`).
- **Alertas**: Alertmanager integrado con Slack (`#alerts-listacompra`).
- **Tracing**: OpenTelemetry exportado a Jaeger.
- **KPIs críticos**:
  - Latencia p95 < 350 ms.
  - Éxito worker IA > 98 %.
  - Retries outbox < 5 por hora.

---

## Procedimientos de Recuperación
1. **Fallo de despliegue**: Helm rollback + reejecución smoke tests.
2. **Base de datos corrupta**:
   - Detener tráfico (`kubectl scale deployment listacompra-api --replicas=0`).
   - Restaurar último snapshot (`pgBackRest restore`).
   - Ejecutar migraciones pendientes.
3. **Pérdida de secretos**: Restaurar desde vault + rotar claves comprometidas.
4. **Fallo de worker IA**: Reintentar job, escalar réplica y revisar cola RabbitMQ.

---

## Checklist de Publicación
- [ ] Tests unitarios e integración verdes.
- [ ] Pipeline CI completado sin errores.
- [ ] Migraciones revisadas y aplicadas.
- [ ] Dashboard Grafana sin alertas activas.
- [ ] Documentación (README, CHANGELOG) actualizada.
- [ ] Release notes publicados y comunicados a stakeholders.

---

> **Contacto**: Equipo DevOps (`devops@listacompra.app`) disponible para soporte en ventanas de despliegue.
