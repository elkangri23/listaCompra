# Guía de Video Tutoriales

## Objetivo
Proporcionar un plan detallado para producir material audiovisual que acelere el onboarding de usuarios y colaboradores. Cada tutorial incluye guion, escenas sugeridas, métricas de éxito y checklist de publicación.

---

## Tutorial 1: Configuración del Entorno de Desarrollo
- **Duración objetivo**: 8 minutos.
- **Audiencia**: Desarrolladores backend/frontend.
- **Guion**:
  1. Introducción (30s) – Presentación del proyecto y objetivos del video.
  2. Requisitos previos (1m) – Node.js, Docker, acceso al repositorio.
  3. Clonado y configuración (`npm install`, `.env.example`) (2m).
  4. Levantar servicios con Docker Compose (1m).
  5. Generar y ejecutar migraciones Prisma (1m).
  6. Ejecutar tests y linting (1m).
  7. Resumen + próximos pasos (30s).
- **Recursos visuales**:
  - Capturas de la estructura de carpetas (VS Code).
  - Terminal con comandos clave.
  - Diagrama breve de arquitectura hexagonal.
- **Call to action**: Leer `Docs/contribution-guide.md`.
- **Checklist de publicación**:
  - [ ] Subtítulos en español y inglés.
  - [ ] Descripción con enlaces a documentación.
  - [ ] Timestamp por sección.
  - [ ] Miniatura destacando "Setup en menos de 10 minutos".

---

## Tutorial 2: Colaboración en Tiempo Real y Gestión de Listas
- **Duración objetivo**: 10 minutos.
- **Audiencia**: Usuarios finales y Product Owners.
- **Guion**:
  1. Introducción a la colaboración (45s).
  2. Crear una lista desde cero (1m).
  3. Compartir lista y gestionar permisos (2m).
  4. Sincronización en tiempo real (demo WebSocket/SSE) (2m).
  5. Registro de historial de cambios (1m) – referencia a CU-20.
  6. Alertas IA y recomendaciones (1m 30s).
  7. Buenas prácticas de colaboración (1m).
  8. Cierre y recursos adicionales (45s).
- **Recursos visuales**:
  - Grabación de la interfaz web con dos navegadores.
  - Overlay mostrando eventos en tiempo real.
  - Insert de notificaciones IA.
- **Métricas de éxito**: Tasa de retención > 60%, comentarios con dudas resueltas en <24h.
- **Checklist de publicación**:
  - [ ] Mostrar versión de la aplicación utilizada.
  - [ ] Añadir capítulos en la plataforma de video.
  - [ ] Validar que datos sensibles estén anonimizados.
  - [ ] Adjuntar enlace a FAQ en descripción.

---

## Tutorial 3: Operación y Despliegue DevOps
- **Duración objetivo**: 12 minutos.
- **Audiencia**: Equipo DevOps y Tech Leads.
- **Guion**:
  1. Presentación de la pipeline CI/CD (1m).
  2. Explicación del flujo Git (`feature` → `main` → `release`) (1m).
  3. Ejecución de pipeline en GitHub Actions (2m).
  4. Construcción y publicación de imágenes Docker (1m 30s).
  5. Despliegue a staging con Helm (2m).
  6. Validación de healthchecks y dashboards Grafana (1m 30s).
  7. Procedimiento de rollback controlado (1m).
  8. Checklist de publicación y comunicación (1m).
  9. Resumen y recursos (30s).
- **Recursos visuales**:
  - Capturas del pipeline en GitHub Actions.
  - Terminal ejecutando comandos Helm/kubectl.
  - Dashboard Grafana destacando KPIs.
- **Checklist de publicación**:
  - [ ] Incluir enlace a `Docs/deployment-guide.md`.
  - [ ] Insertar gráficos de monitoreo reales.
  - [ ] Añadir tarjetas finales con otros tutoriales.
  - [ ] Registrar fecha y versión del proceso.

---

## Plan de Producción
1. **Preproducción**: Validar guiones con Tech Leads y PO. Preparar scripts y escenarios demo.
2. **Producción**: Grabar pantalla en 1080p, audio con micrófono dedicado, usar overlay de cámara opcional.
3. **Postproducción**: Editar con plantillas de branding, añadir subtítulos automáticos y revisión manual.
4. **Publicación**: Subir a YouTube/Vimeo privado, compartir en Confluence y Slack (`#onboarding`).
5. **Mantenimiento**: Revisar cada sprint si hay cambios en flujos críticos; actualizar timestamps y enlaces.

---

## Métricas y Feedback
- **KPIs**: Visualizaciones, retención promedio, encuestas de satisfacción (>4/5).
- **Feedback Loop**: Recopilar comentarios en formulario interno, revisar en retrospectiva mensual.
- **Acción Correctiva**: Actualizar guiones y documentación cuando existan cambios de arquitectura o UX.

---

> Responsable de la serie: `enablement@listacompra.app`
