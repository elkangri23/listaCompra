# Guía Avanzada de Contribución

## Tabla de Contenidos
1. [Objetivo del Documento](#objetivo-del-documento)
2. [Requisitos Iniciales](#requisitos-iniciales)
3. [Flujo de Trabajo Git](#flujo-de-trabajo-git)
4. [Convenciones de Código](#convenciones-de-código)
5. [Calidad y Testing](#calidad-y-testing)
6. [Revisión de Código](#revisión-de-código)
7. [Gestión de Documentación](#gestión-de-documentación)
8. [Checklist para Pull Requests](#checklist-para-pull-requests)
9. [Roles y Responsabilidades](#roles-y-responsabilidades)
10. [Preguntas Frecuentes](#preguntas-frecuentes)

---

## Objetivo del Documento
Estandarizar la colaboración en **ListaCompra**, garantizando entregables consistentes, mantenibles y auditables. Toda contribución debe respetar la arquitectura hexagonal, las reglas de dominio y los acuerdos de calidad establecidos.

---

## Requisitos Iniciales
- **Stack**: Node.js 20 LTS, npm 10+, Docker 24+.
- **Conocimiento**: Arquitectura Hexagonal, DDD básico, Prisma ORM, testing con Jest.
- **Accesos**: GitHub (org `listacompra`), tablero Jira (`LISTA-BOARD`), Postman Team Workspace.

---

## Flujo de Trabajo Git
1. **Crear issue** en Jira o vincular a uno existente (`LISTA-###`).
2. **Branching** (`git checkout -b feature/LISTA-###-descripcion-corta`).
3. Mantener la rama sincronizada con `main` (`git fetch origin && git rebase origin/main`).
4. Commits siguiendo **Conventional Commits**:
   - `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `build:`.
   - Incluir identificador Jira al final (`(#LISTA-123)`).
5. Push remoto y apertura de Pull Request (PR) hacia `main`.

> **Regla**: No mezclar múltiples casos de uso en un mismo PR. Mantener diffs < 500 LOC cuando sea posible.

---

## Convenciones de Código
- **TypeScript**: `strict` habilitado. Evitar `any` y `!` con excepciones justificadas.
- **Domain Layer**: Inmutabilidad en Value Objects, entidades con invariantes claras, sin dependencias de infraestructura.
- **Aplicación**: Casos de uso orquestan puertos, evitar lógica de presentación.
- **Infraestructura**: Adaptadores aislados, mapear errores a HTTP apropiado.
- **Estilo**: ESLint + Prettier (`npm run lint` y `npm run format`).
- **Testing**: Cada caso de uso debe tener pruebas unitarias; controladores con pruebas de integración.

---

## Calidad y Testing
1. Ejecutar `npm run lint` y `npm run test` antes de cada push.
2. Para cambios en repositorios Prisma: `npm run test:integration`.
3. Casos que afectan endpoints → actualizar Postman + `API_Testing_Guide.md`.
4. Validar cobertura mínima 80% en archivos modificados (`npm run test:cov`).
5. Documentar manualmente E2E afectados en Jira.

---

## Revisión de Código
- **Revisores requeridos**: 1 Backend + 1 QA cuando el cambio afecta lógica crítica.
- **Tiempo de respuesta**: Máximo 24h hábiles.
- **Checklist del revisor**:
  - Cumple arquitectura hexagonal.
  - Tests agregados y pasando.
  - Manejo de errores consistente.
  - Documentación actualizada.
  - Sin secretos o datos sensibles en el código.
- Solicitar cambios con comentarios accionables; no aprobar con `nit` sin follow-up.

---

## Gestión de Documentación
- Actualizar `DOCS_INDEX.md` al añadir o retirar documentos relevantes.
- Mantener diagramas en la carpeta `Docs/` (preferir formato Mermaid + PNG/SVG exportado).
- Registrar decisiones arquitectónicas en `Docs/architecture.md` (sección ADRs).
- Documentar endpoints nuevos en Swagger + Postman.

---

## Checklist para Pull Requests
- [ ] Descripción clara del objetivo y alcance.
- [ ] Capturas o GIF cuando aplique (UI/UX).
- [ ] Referencias a issues Jira (`Closes LISTA-###`).
- [ ] Resultados de comandos (`npm run test`, `npm run lint`).
- [ ] Cambios de base de datos justificados y versionados.
- [ ] Documentación sincronizada.
- [ ] Sin TODOs o console.log residuales.

---

## Roles y Responsabilidades
| Rol             | Responsabilidad Principal                           |
|-----------------|------------------------------------------------------|
| **Contributor** | Implementar cambios y pruebas unitarias.             |
| **Reviewer**    | Validar calidad técnica y consistencia arquitectónica|
| **QA Lead**     | Asegurar cobertura y escenarios críticos.            |
| **Release Mgr** | Coordinar ventanas de despliegue y comunicación.     |
| **PO**          | Priorizar backlog y aceptar entregables.             |

---

## Preguntas Frecuentes
- **¿Cuándo puedo fusionar un PR?** → Tras recibir 2 aprobaciones y CI verde.
- **¿Qué hago si falla una suite E2E?** → Abrir bug en Jira, adjuntar logs, bloquear release hasta resolverse.
- **¿Puedo hacer hotfix directo en `main`?** → Solo con aprobación del Release Manager y etiquetado `hotfix/x.y.z`.
- **¿Cómo documento una decisión importante?** → Añadir ADR en `Docs/architecture.md` o crear archivo `Docs/adr/ADR-###.md`.

---

> Para dudas adicionales contactar `tech-leads@listacompra.app`.
