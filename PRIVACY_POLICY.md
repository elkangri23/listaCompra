# 🔒 Política de Privacidad

**Lista de la Compra Colaborativa**

**Fecha de última actualización:** 29 de octubre de 2025  
**Versión:** 1.0

---

## 1. Introducción

En Lista de la Compra Colaborativa (en adelante, "nosotros", "nuestro" o "el Servicio"), nos comprometemos a proteger su privacidad y sus datos personales. Esta Política de Privacidad explica qué información recopilamos, cómo la utilizamos, la compartimos y la protegemos.

### 1.1. Aceptación
Al utilizar el Servicio, usted acepta las prácticas descritas en esta Política de Privacidad. Si no está de acuerdo, no utilice el Servicio.

### 1.2. Alcance
Esta política se aplica a todos los usuarios del Servicio, independientemente de su ubicación geográfica.

---

## 2. Información que Recopilamos

### 2.1. Información de Registro
Cuando crea una cuenta, recopilamos:
- **Nombre completo**
- **Dirección de correo electrónico**
- **Contraseña** (almacenada de forma hasheada con bcrypt)
- **Fecha de registro**
- **Rol de usuario** (USER, ADMIN)

### 2.2. Contenido del Usuario
Durante el uso del Servicio, almacenamos:
- **Listas de compra**: Nombres, descripciones, estado
- **Productos**: Nombres, cantidades, precios, categorías, estado de compra
- **Tiendas y categorías**: Nombres, tipos, ubicaciones
- **Plantillas (Blueprints)**: Configuraciones guardadas de listas
- **Invitaciones**: Enlaces compartidos y permisos otorgados

### 2.3. Datos de Uso y Analítica
Recopilamos automáticamente:
- **Logs de acceso**: Fecha, hora, IP, endpoints visitados
- **Eventos de sistema**: Creación, modificación, eliminación de recursos
- **Métricas de rendimiento**: Tiempos de respuesta, errores
- **Uso de funcionalidades de IA**: Consultas realizadas, resultados generados

### 2.4. Información Técnica
Recopilamos datos técnicos como:
- **Dirección IP**
- **Tipo de navegador y versión**
- **Sistema operativo**
- **Identificadores de sesión**
- **Tokens de autenticación** (JWT con expiración)

### 2.5. Datos de IA
Al utilizar funcionalidades de Inteligencia Artificial:
- **Prompts y consultas** enviadas a servicios de IA
- **Respuestas generadas** por algoritmos de IA
- **Patrones de uso** para mejora de modelos (anónimos y agregados)
- **Cache de respuestas** para optimización de costos

---

## 3. Cómo Utilizamos Su Información

### 3.1. Provisión del Servicio
Utilizamos sus datos para:
- Crear y gestionar su cuenta de usuario
- Autenticar su identidad con JWT
- Almacenar y mostrar sus listas y productos
- Facilitar la compartición y colaboración con otros usuarios
- Enviar notificaciones por email sobre invitaciones

### 3.2. Funcionalidades de IA
Sus datos se utilizan para:
- **Categorización automática**: Sugerir categorías para productos
- **Listas inteligentes**: Generar listas completas basadas en ocasiones específicas
- **Análisis de hábitos**: Proporcionar insights sobre patrones de compra (futuro)
- **Recomendaciones**: Sugerir productos complementarios (futuro)
- **Mejora de algoritmos**: Entrenar modelos de IA de forma anónima y agregada

### 3.3. Mejora del Servicio
Utilizamos datos agregados y anónimos para:
- Analizar tendencias de uso
- Identificar y corregir errores
- Optimizar rendimiento y escalabilidad
- Desarrollar nuevas funcionalidades
- Realizar pruebas A/B

### 3.4. Comunicaciones
Podemos usar su email para enviar:
- Notificaciones de invitaciones a listas compartidas
- Alertas de seguridad (cambios de contraseña, accesos sospechosos)
- Actualizaciones importantes del Servicio
- Respuestas a consultas de soporte técnico

### 3.5. Seguridad y Cumplimiento
Utilizamos datos para:
- Prevenir fraude y abuso
- Detectar actividades sospechosas
- Cumplir con obligaciones legales
- Responder a solicitudes de autoridades competentes
- Mantener logs de auditoría (especialmente para acciones administrativas)

---

## 4. Base Legal para el Procesamiento (GDPR)

Procesamos sus datos personales bajo las siguientes bases legales:

### 4.1. Ejecución de Contrato
Para proporcionar el Servicio según los Términos y Condiciones aceptados.

### 4.2. Consentimiento
Para funcionalidades opcionales como analítica avanzada o comunicaciones promocionales (futuro).

### 4.3. Interés Legítimo
Para mejorar el Servicio, prevenir fraude y garantizar seguridad.

### 4.4. Obligación Legal
Para cumplir con leyes aplicables, como retención de datos fiscales o respuesta a órdenes judiciales.

---

## 5. Compartición de Información

### 5.1. Con Otros Usuarios
Compartimos información cuando:
- **Comparte una lista**: Los colaboradores pueden ver productos, cantidades, precios
- **Invita usuarios**: El destinatario recibe un enlace con acceso controlado
- **Blueprints públicos**: Si marca una plantilla como pública, otros usuarios pueden verla

### 5.2. Con Proveedores de Servicios
Compartimos datos con proveedores de terceros bajo acuerdos de confidencialidad:

| Proveedor | Servicio | Datos Compartidos |
|-----------|----------|-------------------|
| **PostgreSQL (Hosting)** | Base de datos | Todos los datos del usuario |
| **RabbitMQ (Hosting)** | Mensajería | Eventos de sistema |
| **Perplexity API** | IA (Llama 3.1 Sonar) | Prompts anónimos, nombres de productos |
| **Redis (Caché)** | Caché de IA | Respuestas IA temporales |
| **Gmail SMTP** | Email | Direcciones de email, contenido de notificaciones |

### 5.3. Con Autoridades Legales
Podemos divulgar información si:
- Es requerido por ley o proceso legal
- Es necesario para proteger nuestros derechos legales
- Existe riesgo para la seguridad de usuarios o del público
- Se requiere para investigar fraude o abuso

### 5.4. Transferencias Empresariales
En caso de fusión, adquisición o venta de activos, sus datos pueden ser transferidos a la nueva entidad.

### 5.5. No Vendemos Datos
**Nunca vendemos sus datos personales a terceros para marketing o publicidad.**

---

## 6. Seguridad de los Datos

### 6.1. Medidas Técnicas
Implementamos múltiples capas de seguridad:

| Medida | Implementación |
|--------|----------------|
| **Contraseñas** | Hasheadas con bcrypt (salt rounds: 10) |
| **Autenticación** | JWT con expiración (1 hora) y refresh tokens |
| **Rate Limiting** | Límites por IP y usuario para prevenir ataques |
| **Validación** | Sanitización de inputs con Zod/Joi |
| **HTTPS** | Comunicaciones encriptadas (producción) |
| **Logs de Auditoría** | Tracking de acciones administrativas sensibles |

### 6.2. Medidas Organizativas
- Acceso restringido a datos solo para personal autorizado
- Políticas de seguridad y confidencialidad para administradores
- Revisiones periódicas de seguridad
- Respuesta rápida a incidentes de seguridad

### 6.3. Limitaciones
Ningún sistema es 100% seguro. Aunque implementamos medidas robustas, no podemos garantizar la seguridad absoluta. Es su responsabilidad mantener segura su contraseña.

---

## 7. Retención de Datos

### 7.1. Datos de Cuenta Activa
Mientras su cuenta esté activa, retenemos:
- Toda la información de perfil
- Listas, productos y blueprints
- Historial de compartición y permisos

### 7.2. Datos de IA y Cache
- **Cache de respuestas IA**: 1-24 horas (según configuración)
- **Logs de uso de IA**: 90 días (anónimos)
- **Datos agregados para entrenamiento**: Indefinidamente (anónimos)

### 7.3. Logs de Sistema
- **Logs de acceso**: 90 días
- **Logs de auditoría administrativa**: 2 años (requisitos de compliance)
- **Logs de seguridad**: 1 año

### 7.4. Eliminación de Cuenta
Al eliminar su cuenta:
- **Inmediato**: Perfil de usuario, listas, productos, blueprints
- **30 días**: Datos en backups
- **Permanente**: Logs de auditoría requeridos por ley (anónimos)

---

## 8. Sus Derechos (GDPR y LOPD)

### 8.1. Derecho de Acceso
Puede solicitar una copia de todos sus datos personales en formato estructurado.

### 8.2. Derecho de Rectificación
Puede corregir información inexacta o incompleta desde la configuración de su cuenta.

### 8.3. Derecho de Eliminación (Derecho al Olvido)
Puede solicitar la eliminación de su cuenta y todos los datos asociados.

### 8.4. Derecho de Portabilidad
Puede exportar sus datos en formato JSON o CSV (funcionalidad futura).

### 8.5. Derecho de Oposición
Puede oponerse al procesamiento de sus datos para ciertos fines (marketing, analítica).

### 8.6. Derecho de Restricción
Puede solicitar que limitemos el procesamiento de sus datos en ciertas circunstancias.

### 8.7. Derecho a No Ser Objeto de Decisiones Automatizadas
Las decisiones de IA no afectan sus derechos fundamentales. Puede solicitar revisión manual.

### 8.8. Cómo Ejercer Sus Derechos
Para ejercer cualquiera de estos derechos:
1. Envíe una solicitud a: privacy@listacompra.com (email ficticio)
2. Incluya: nombre, email registrado, derecho a ejercer y justificación
3. Responderemos en un plazo máximo de 30 días

---

## 9. Cookies y Tecnologías de Seguimiento

### 9.1. Cookies Esenciales
Utilizamos cookies esenciales para:
- Mantener su sesión autenticada (JWT)
- Recordar preferencias de idioma/interfaz
- Prevenir CSRF (Cross-Site Request Forgery)

### 9.2. Cookies de Analítica (Futuro)
Podemos implementar cookies de analítica para:
- Entender patrones de uso
- Mejorar experiencia de usuario
- Optimizar rendimiento

### 9.3. Control de Cookies
Puede configurar su navegador para rechazar cookies, pero esto puede afectar la funcionalidad del Servicio.

---

## 10. Privacidad de Menores

El Servicio **no está destinado a menores de 18 años**. No recopilamos intencionadamente datos de menores. Si descubrimos que hemos recopilado datos de un menor, los eliminaremos inmediatamente.

Si es padre/tutor y cree que su hijo nos ha proporcionado datos, contáctenos en: privacy@listacompra.com (ficticio).

---

## 11. Transferencias Internacionales

### 11.1. Ubicación de Datos
Sus datos se almacenan principalmente en servidores ubicados en:
- **Unión Europea** (recomendado para producción)
- Servidores locales de desarrollo (España)

### 11.2. Servicios de Terceros
Algunos proveedores pueden estar fuera de la UE:
- **Perplexity API**: Estados Unidos (con cláusulas contractuales estándar)

### 11.3. Garantías
Cuando transferimos datos fuera de la UE, garantizamos protección mediante:
- Cláusulas contractuales estándar aprobadas por la Comisión Europea
- Privacy Shield o mecanismos equivalentes
- Consentimiento explícito cuando sea necesario

---

## 12. Funcionalidades de IA y Privacidad

### 12.1. Datos Enviados a IA
Al usar funcionalidades de IA, enviamos:
- Nombres de productos (para categorización)
- Contexto de ocasión, número de personas, presupuesto (para listas inteligentes)
- Productos actuales en lista (para recomendaciones - futuro)

### 12.2. Anonimización
- Los prompts de IA **no incluyen** su nombre, email o datos personales identificables
- Los datos se envían de forma anónima a Perplexity API
- Las respuestas se cachean de forma segura en Redis

### 12.3. No Entrenamiento con Datos Personales
- Perplexity API no entrena modelos con sus datos según su política de privacidad
- Nosotros solo usamos datos agregados y anónimos para mejorar prompts

### 12.4. Control del Usuario
Puede:
- Optar por no usar funcionalidades de IA (usar categorías manualmente)
- Revisar y editar sugerencias de IA antes de aceptarlas
- Reportar sugerencias inapropiadas

---

## 13. Notificaciones por Email

### 13.1. Tipos de Emails
Enviamos emails para:
- **Transaccionales**: Invitaciones a listas compartidas (necesarios)
- **Seguridad**: Cambios de contraseña, accesos sospechosos (necesarios)
- **Servicio**: Actualizaciones críticas del Servicio (necesarios)
- **Marketing**: Nuevas funcionalidades, consejos (opcionales - futuro)

### 13.2. Configuración de Preferencias
Puede configurar qué emails recibir desde la configuración de su cuenta (funcionalidad futura).

### 13.3. Emails Transaccionales
No puede desactivar emails transaccionales (invitaciones, seguridad) mientras mantenga su cuenta activa.

---

## 14. Cambios en la Política de Privacidad

### 14.1. Notificación de Cambios
Si realizamos cambios significativos a esta política:
- Le notificaremos por email con al menos 30 días de antelación
- Publicaremos un aviso destacado en el Servicio
- Actualizaremos la fecha de "última actualización"

### 14.2. Revisión Periódica
Le recomendamos revisar esta política periódicamente para estar informado sobre cómo protegemos sus datos.

---

## 15. Administradores y Acceso a Datos

### 15.1. Funcionalidad de Impersonación
Los administradores pueden:
- Acceder a cuentas de usuarios para soporte técnico (con registro en auditoría)
- Ver datos de listas y productos para debugging
- Revisar logs de sistema para seguridad

### 15.2. Políticas de Administradores
Los administradores están sujetos a:
- Acuerdos de confidencialidad estrictos
- Acceso basado en necesidad legítima
- Registro completo de todas las acciones en logs de auditoría
- Políticas de retención de logs (2 años)

### 15.3. Transparencia
Puede solicitar información sobre:
- Cuántas veces se accedió a su cuenta por administradores
- Razones del acceso (cuando sea legalmente posible)
- Datos específicos consultados

---

## 16. Responsabilidad del Usuario

### 16.1. Seguridad de Contraseña
Es su responsabilidad:
- Elegir una contraseña segura (mínimo 8 caracteres)
- No compartir su contraseña con terceros
- Notificar inmediatamente accesos no autorizados

### 16.2. Precisión de Datos
Debe proporcionar información precisa y actualizada en su perfil.

### 16.3. Contenido Sensible
Evite incluir en listas:
- Números de tarjetas de crédito
- Información médica sensible
- Datos de terceros sin consentimiento

---

## 17. Cumplimiento Legal

### 17.1. Normativas Aplicables
Cumplimos con:
- **GDPR** (Reglamento General de Protección de Datos - UE)
- **LOPD** (Ley Orgánica de Protección de Datos - España)
- **LSSI** (Ley de Servicios de la Sociedad de la Información - España)

### 17.2. Delegado de Protección de Datos
Puedes contactar con nuestro DPO (Data Protection Officer) en:
- **Email**: dpo@listacompra.com (ficticio)
- **Dirección**: [Dirección física de la empresa - ficticio]

### 17.3. Autoridad de Control
Tiene derecho a presentar una reclamación ante la autoridad de protección de datos:
- **España**: Agencia Española de Protección de Datos (AEPD) - www.aepd.es

---

## 18. Contacto

Para preguntas sobre privacidad o ejercer sus derechos:

**Email de Privacidad**: privacy@listacompra.com (ficticio)  
**Email de Soporte**: support@listacompra.com (ficticio)  
**GitHub Issues**: https://github.com/elkangri23/listaCompra/issues  

**Tiempo de respuesta esperado**: 5-10 días hábiles (máximo 30 días por GDPR)

---

## 19. Transparencia y Recursos

### 19.1. Documentación Técnica
Para desarrolladores y usuarios avanzados:
- **Arquitectura de seguridad**: Ver `SECURITY_AUDIT.md`
- **Código abierto**: Repositorio público en GitHub
- **API Documentation**: Swagger disponible en `/api-docs`

### 19.2. Recursos Adicionales
- [Términos y Condiciones](TERMS_AND_CONDITIONS.md)
- [Documentación del proyecto](README.md)
- [Guía de arquitectura](AGENTS.md)

---

**© 2025 Lista de la Compra Colaborativa. Todos los derechos reservados.**

*Este documento es parte del proyecto open-source Lista de la Compra Colaborativa. Versión 1.0 - Última actualización: 29 de octubre de 2025.*

---

## Anexo: Resumen de Datos Recopilados

| Categoría | Datos | Finalidad | Base Legal | Retención |
|-----------|-------|-----------|------------|-----------|
| **Cuenta** | Nombre, email, contraseña | Provisión servicio | Contrato | Mientras cuenta activa |
| **Listas** | Nombres, productos, precios | Funcionalidad core | Contrato | Mientras cuenta activa |
| **Compartición** | Permisos, invitaciones | Colaboración | Contrato | Mientras lista activa |
| **IA** | Prompts, respuestas | Funcionalidad premium | Interés legítimo | Cache: 1-24h |
| **Logs** | IP, accesos, eventos | Seguridad | Interés legítimo | 90 días - 2 años |
| **Auditoría** | Acciones admin | Compliance | Obligación legal | 2 años |

---

**Agradecemos su confianza en Lista de la Compra Colaborativa. Su privacidad es nuestra prioridad.**
