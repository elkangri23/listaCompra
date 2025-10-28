# Casos de Uso Completos - Lista de la Compra Colaborativa

## Caso de Uso 1: Registro de Usuario
**Actor principal**: Usuario no registrado
**Flujo principal**:
1. El usuario accede al endpoint de registro de la aplicación
2. Introduce email, nombre completo y contraseña válidos
3. El sistema valida que el email no esté registrado previamente
4. El sistema verifica que la contraseña cumple criterios (mín 8 caracteres, 1 mayúscula, 1 minúscula, 1 número)
5. El sistema encripta la contraseña con SHA-256 y crea el usuario en la base de datos
6. Se genera automáticamente un ID único y fecha de creación
7. El sistema confirma el registro exitoso con código 201
**Alternativos**:
- Email ya registrado: Se devuelve error 409 "Email ya en uso"
- Contraseña inválida: Se devuelve error 400 con detalle de criterios no cumplidos
- Email con formato inválido: Se devuelve error 400 "Formato de email inválido"
- Campos obligatorios faltantes: Se devuelve error 400 con lista de campos requeridos
- Error en base de datos: Se devuelve error 500 "Error interno del servidor"

## Caso de Uso 2: Autenticación de Usuario
**Actor principal**: Usuario registrado
**Flujo principal**:
1. El usuario accede al endpoint de login
2. Proporciona email y contraseña
3. El sistema valida las credenciales contra la base de datos
4. El sistema genera un token JWT con tiempo de expiración
5. Se devuelve el token junto con datos básicos del usuario
6. El usuario queda autenticado para hacer peticiones posteriores
**Alternativos**:
- Credenciales incorrectas: Se devuelve error 401 "Email o contraseña incorrectos"
- Usuario no existe: Se devuelve error 404 "Usuario no encontrado"
- Campos faltantes: Se devuelve error 400 "Email y contraseña son requeridos"
- Usuario bloqueado/inactivo: Se devuelve error 403 "Cuenta inactiva"

## Caso de Uso 3: Crear Lista de la Compra
**Actor principal**: Usuario autenticado
**Flujo principal**:
1. El usuario envía petición POST al endpoint de creación de listas
2. Proporciona nombre de la lista, descripción opcional y tienda seleccionada
3. El sistema valida que el usuario esté autenticado via JWT
4. Se verifica que la tienda seleccionada exista en el sistema
5. El sistema crea la lista asociada al usuario con fecha de creación actual
6. Se genera un ID único para la lista
7. Se devuelve la lista creada con código 201
**Alternativos**:
- Token JWT inválido/expirado: Se devuelve error 401 "Token no válido"
- Nombre de lista vacío: Se devuelve error 400 "Nombre de lista requerido"
- Tienda inexistente: Se devuelve error 404 "Tienda no encontrada"
- Usuario alcanza límite de listas: Se devuelve error 429 "Límite de listas excedido"
- Nombre de lista duplicado: Se devuelve error 409 "Ya existe una lista con ese nombre"

## Caso de Uso 4: Obtener Listas del Usuario
**Actor principal**: Usuario autenticado
**Flujo principal**:
1. El usuario envía petición GET al endpoint de sus listas
2. El sistema valida la autenticación JWT
3. Se consultan todas las listas asociadas al usuario
4. Se incluyen datos básicos de cada lista (id, nombre, descripción, tienda, fecha creación)
5. Se devuelve array de listas con código 200
**Alternativos**:
- Usuario sin listas: Se devuelve array vacío con código 200
- Token inválido: Se devuelve error 401 "No autorizado"
- Error en consulta: Se devuelve error 500 "Error al obtener listas"

## Caso de Uso 5: Actualizar Lista de la Compra
**Actor principal**: Usuario propietario de la lista
**Flujo principal**:
1. El usuario envía petición PUT/PATCH con ID de lista y datos a actualizar
2. El sistema valida autenticación y que el usuario sea propietario de la lista
3. Se validan los campos a actualizar (nombre, descripción, tienda)
4. El sistema actualiza los campos modificados en la base de datos
5. Se devuelve la lista actualizada con código 200
**Alternativos**:
- Lista no pertenece al usuario: Se devuelve error 403 "Sin permisos para modificar esta lista"
- Lista no existe: Se devuelve error 404 "Lista no encontrada"
- Datos inválidos: Se devuelve error 400 con detalles de validación
- Tienda nueva no existe: Se devuelve error 404 "Tienda seleccionada no existe"

## Caso de Uso 6: Eliminar Lista de la Compra
**Actor principal**: Usuario propietario de la lista
**Flujo principal**:
1. El usuario envía petición DELETE con ID de lista
2. El sistema valida autenticación y propiedad de la lista
3. Se verifica que no existan dependencias críticas (invitaciones activas)
4. Se eliminan primero todos los productos asociados
5. Se eliminan permisos e invitaciones relacionadas
6. Finalmente se elimina la lista principal
7. Se devuelve código 204 (sin contenido)
**Alternativos**:
- Lista no pertenece al usuario: Se devuelve error 403 "Sin permisos"
- Lista no existe: Se devuelve error 404 "Lista no encontrada"
- Lista tiene colaboradores activos: Se devuelve error 409 "No se puede eliminar lista con colaboradores activos"
- Error en eliminación cascada: Se devuelve error 500 "Error al eliminar lista"

## Caso de Uso 7: Agregar Producto a Lista
**Actor principal**: Usuario con permisos de escritura en la lista
**Flujo principal**:
1. El usuario envía petición POST al endpoint de productos
2. Proporciona nombre del producto, cantidad, precio opcional, categoría opcional y lista de destino
3. El sistema valida permisos del usuario sobre la lista
4. Se verifica que la categoría (si se proporciona) exista y pertenezca a la tienda de la lista
5. El sistema crea el producto con estado "no comprado" por defecto
6. Se asigna ID único y se asocia a la lista
7. Se devuelve el producto creado con código 201
**Alternativos**:
- Sin permisos de escritura: Se devuelve error 403 "Sin permisos para agregar productos"
- Lista no existe: Se devuelve error 404 "Lista no encontrada"
- Categoría no válida: Se devuelve error 400 "Categoría no pertenece a esta tienda"
- Producto duplicado: Se puede permitir o incrementar cantidad según configuración
- Datos inválidos: Se devuelve error 400 con detalles de validación

## Caso de Uso 8: Marcar/Desmarcar Producto como Comprado
**Actor principal**: Usuario con acceso a la lista
**Flujo principal**:
1. El usuario envía petición PATCH al producto específico
2. Se cambia el estado booleano "comprado" del producto
3. El sistema valida permisos del usuario sobre la lista contenedora
4. Se actualiza el campo "comprado" en la base de datos
5. Opcionalmente se registra timestamp de la acción
6. Se devuelve el producto actualizado con código 200
**Alternativos**:
- Sin permisos: Se devuelve error 403 "Sin permisos para modificar esta lista"
- Producto no existe: Se devuelve error 404 "Producto no encontrado"
- Lista no accesible: Se devuelve error 404 "Lista no encontrada o sin acceso"

## Caso de Uso 9: Modificar Producto
**Actor principal**: Usuario con permisos de escritura
**Flujo principal**:
1. El usuario envía petición PUT/PATCH con ID del producto y campos a modificar
2. El sistema valida permisos de escritura sobre la lista contenedora
3. Se validan los nuevos datos (nombre, cantidad, precio, categoría)
4. Si se cambia categoría, se verifica que pertenezca a la tienda de la lista
5. Se actualiza el producto en la base de datos
6. Se devuelve el producto modificado con código 200
**Alternativos**:
- Sin permisos de escritura: Se devuelve error 403 "Sin permisos para modificar productos"
- Producto no existe: Se devuelve error 404 "Producto no encontrado"
- Nueva categoría inválida: Se devuelve error 400 "Categoría no válida para esta tienda"
- Datos de validación incorrectos: Se devuelve error 400 con detalles

## Caso de Uso 10: Eliminar Producto de Lista
**Actor principal**: Usuario con permisos de escritura
**Flujo principal**:
1. El usuario envía petición DELETE con ID del producto
2. El sistema valida permisos de escritura sobre la lista
3. Se verifica que el producto exista y pertenezca a una lista accesible
4. Se elimina el producto de la base de datos
5. Se devuelve código 204 (sin contenido)
**Alternativos**:
- Sin permisos: Se devuelve error 403 "Sin permisos para eliminar productos"
- Producto no existe: Se devuelve error 404 "Producto no encontrado"
- Producto ya eliminado: Se devuelve código 204 (idempotente)

## Caso de Uso 11: Crear Categoría (Pasillo)
**Actor principal**: Usuario autenticado
**Flujo principal**:
1. El usuario envía petición POST al endpoint de categorías
2. Proporciona nombre, descripción opcional, color opcional y tienda asociada
3. El sistema valida que la tienda exista
4. Se verifica que no exista categoría con mismo nombre en esa tienda
5. El sistema crea la categoría asociada al usuario y tienda
6. Se asigna color por defecto si no se proporciona
7. Se devuelve la categoría creada con código 201
**Alternativos**:
- Tienda no existe: Se devuelve error 404 "Tienda no encontrada"
- Categoría duplicada: Se devuelve error 409 "Ya existe categoría con ese nombre en esta tienda"
- Nombre vacío: Se devuelve error 400 "Nombre de categoría requerido"
- Sin permisos: Se devuelve error 401 "Usuario no autenticado"

## Caso de Uso 12: Obtener Categorías de Tienda
**Actor principal**: Usuario autenticado
**Flujo principal**:
1. El usuario envía petición GET al endpoint de categorías con ID de tienda
2. El sistema busca todas las categorías asociadas a esa tienda
3. Se incluyen tanto categorías predefinidas como las creadas por usuarios
4. Se devuelve array de categorías con código 200
**Alternativos**:
- Tienda sin categorías: Se devuelve array vacío con código 200
- Tienda no existe: Se devuelve error 404 "Tienda no encontrada"
- Sin autenticación: Se devuelve error 401 "Token requerido"

## Caso de Uso 13: Actualizar Categoría
**Actor principal**: Usuario creador de la categoría
**Flujo principal**:
1. El usuario envía petición PUT/PATCH con ID de categoría y datos a modificar
2. El sistema valida que el usuario sea creador de la categoría
3. Se validan los nuevos datos (nombre, descripción, color)
4. Se verifica que el nuevo nombre no esté duplicado en la tienda
5. Se actualiza la categoría en la base de datos
6. Se devuelve la categoría modificada con código 200
**Alternativos**:
- No es creador: Se devuelve error 403 "Solo el creador puede modificar esta categoría"
- Categoría no existe: Se devuelve error 404 "Categoría no encontrada"
- Nombre duplicado: Se devuelve error 409 "Ya existe categoría con ese nombre"
- Categoría predefinida: Se devuelve error 403 "No se pueden modificar categorías predefinidas"

## Caso de Uso 14: Eliminar Categoría
**Actor principal**: Usuario creador de la categoría
**Flujo principal**:
1. El usuario envía petición DELETE con ID de categoría
2. El sistema valida que el usuario sea creador de la categoría
3. Se verifica que no existan productos asociados a esta categoría
4. Se elimina la categoría de la base de datos
5. Se devuelve código 204 (sin contenido)
**Alternativos**:
- Categoría con productos: Se devuelve error 409 "No se puede eliminar categoría con productos asociados"
- No es creador: Se devuelve error 403 "Solo el creador puede eliminar esta categoría"
- Categoría no existe: Se devuelve error 404 "Categoría no encontrada"
- Categoría predefinida: Se devuelve error 403 "No se pueden eliminar categorías predefinidas del sistema"

## Caso de Uso 15: Compartir Lista (Generar Enlace)
**Actor principal**: Usuario propietario de la lista
**Flujo principal**:
1. El usuario envía petición POST al endpoint de compartir lista
2. Especifica tipo de permiso (lectura o lectura/escritura) y opcionalmente email del invitado
3. El sistema valida que el usuario sea propietario de la lista
4. Se genera un hash único criptográficamente seguro para el enlace
5. Se crea registro de invitación con estado "pendiente"
6. Se publica evento "ListaCompartida" en el outbox para notificaciones
7. Se devuelve el enlace de invitación con código 201
**Alternativos**:
- Lista no pertenece al usuario: Se devuelve error 403 "Solo el propietario puede compartir la lista"
- Lista no existe: Se devuelve error 404 "Lista no encontrada"
- Invitación ya existe para ese email: Se devuelve la invitación existente o se actualiza
- Error generando hash: Se devuelve error 500 "Error interno al generar invitación"
- Límite de invitaciones alcanzado: Se devuelve error 429 "Límite de invitaciones excedido"

## Caso de Uso 16: Acceder a Lista Compartida (Usuario Invitado)
**Actor principal**: Usuario invitado (no autenticado)
**Flujo principal**:
1. El usuario accede a la URL con hash de invitación
2. El sistema valida que el hash sea válido y no haya expirado
3. Se verifica que la invitación esté en estado "pendiente" o "aceptada"
4. Se proporciona acceso a la lista según permisos asignados
5. Si es primer acceso, se actualiza estado a "aceptada" y se registra fecha de respuesta
6. Se devuelve la lista completa con productos según permisos
**Alternativos**:
- Hash inválido o malformado: Se devuelve error 404 "Enlace de invitación no válido"
- Invitación expirada: Se devuelve error 410 "Enlace de invitación expirado"
- Invitación cancelada: Se devuelve error 403 "Invitación cancelada por el propietario"
- Lista eliminada: Se devuelve error 404 "Lista no disponible"

## Caso de Uso 17: Gestionar Permisos de Lista Compartida
**Actor principal**: Usuario propietario de la lista
**Flujo principal**:
1. El usuario envía petición PUT al endpoint de permisos
2. Especifica ID de invitación y nuevo tipo de permiso
3. El sistema valida que el usuario sea propietario de la lista
4. Se verifica que la invitación exista y esté activa
5. Se actualiza el tipo de permiso en la base de datos
6. Se notifica el cambio al usuario invitado si está especificado
7. Se devuelve la invitación actualizada con código 200
**Alternativos**:
- No es propietario: Se devuelve error 403 "Solo el propietario puede modificar permisos"
- Invitación no existe: Se devuelve error 404 "Invitación no encontrada"
- Permiso inválido: Se devuelve error 400 "Tipo de permiso no válido"
- Invitación inactiva: Se devuelve error 409 "No se pueden modificar permisos de invitación inactiva"

## Caso de Uso 18: Cancelar Invitación
**Actor principal**: Usuario propietario de la lista
**Flujo principal**:
1. El usuario envía petición DELETE al endpoint de invitación específica
2. El sistema valida que el usuario sea propietario de la lista
3. Se verifica que la invitación exista
4. Se actualiza el estado de la invitación a "cancelada"
5. Se revoca acceso inmediato del usuario invitado
6. Se devuelve código 204 (sin contenido)
**Alternativos**:
- No es propietario: Se devuelve error 403 "Solo el propietario puede cancelar invitaciones"
- Invitación no existe: Se devuelve error 404 "Invitación no encontrada"
- Invitación ya cancelada: Se devuelve código 204 (idempotente)

## Caso de Uso 19: Procesar Notificación de Invitación (Worker)
**Actor principal**: Worker del sistema (SAGA/Outbox)
**Flujo principal**:
1. El worker escucha eventos del tipo "ListaCompartida" desde el outbox
2. Extrae información del evento (email invitado, enlace, nombre lista)
3. Se compone el contenido del email de notificación
4. Se envía email con el enlace de invitación al destinatario
5. Se marca el evento como procesado en el outbox
6. Se actualiza estado de invitación si es necesario
**Alternativos**:
- Error en envío de email: Se reintenta según política de retry configurada
- Email inválido: Se marca evento como fallido y se notifica al propietario
- Servicio de email no disponible: Se programa reintento con backoff exponencial
- Error en procesamiento: Se registra error y se mantiene evento para reprocesamiento

## Caso de Uso 20: Solicitar Sugerencias de IA para Categorías
**Actor principal**: Usuario autenticado
**Flujo principal**:
1. El usuario envía petición POST al endpoint de sugerencias IA
2. Especifica la tienda para la cual necesita sugerencias de categorías
3. El sistema valida autenticación del usuario
4. Se consulta API externa de IA (OpenAI/Gemini/Perplexity) con prompt específico
5. Se recibe respuesta con categorías sugeridas para esa tienda
6. Se procesan y formatean las sugerencias recibidas
7. Se devuelven las categorías sugeridas al usuario con código 200
**Alternativos**:
- API de IA no disponible: Se devuelve error 503 "Servicio de IA temporalmente no disponible"
- Timeout en API externa: Se devuelve error 504 "Timeout en servicio de IA"
- Límite de uso de API alcanzado: Se devuelve error 429 "Límite de consultas IA alcanzado"
- Tienda no reconocida por IA: Se devuelven categorías genéricas predefinidas
- Error en formato de respuesta: Se devuelve error 500 "Error procesando sugerencias IA"

## Caso de Uso 21: Analizar Hábitos de Compra con IA
**Actor principal**: Usuario autenticado
**Flujo principal**:
1. El usuario envía petición GET al endpoint de análisis de hábitos
2. El sistema recopila historial de listas y productos del usuario
3. Se prepara dataset con patrones de compra, tiendas frecuentes, categorías más usadas
4. Se envía información a API de IA para análisis de patrones
5. Se recibe análisis con insights sobre hábitos de compra
6. Se procesan y presentan los insights de manera comprensible
7. Se devuelve el análisis al usuario con código 200
**Alternativos**:
- Usuario sin historial suficiente: Se devuelve mensaje indicando necesidad de más datos
- Error en API de IA: Se devuelve error 503 "Análisis no disponible temporalmente"
- Datos insuficientes para análisis: Se devuelve análisis básico con datos disponibles

## Caso de Uso 22: Crear Blueprint/Plantilla de Lista
**Actor principal**: Usuario autenticado
**Flujo principal**:
1. El usuario envía petición POST al endpoint de blueprints
2. Selecciona una lista existente como base para la plantilla
3. Especifica nombre para el blueprint y descripción opcional
4. El sistema copia estructura de la lista (productos, categorías, cantidades)
5. Se crea el blueprint asociado al usuario
6. Se devuelve el blueprint creado con código 201
**Alternativos**:
- Lista base no pertenece al usuario: Se devuelve error 403 "Sin permisos para crear blueprint de esta lista"
- Lista base no existe: Se devuelve error 404 "Lista no encontrada"
- Blueprint con nombre duplicado: Se devuelve error 409 "Ya existe blueprint con ese nombre"
- Lista base vacía: Se permite crear blueprint vacío con advertencia

## Caso de Uso 23: Usar Blueprint para Crear Nueva Lista
**Actor principal**: Usuario propietario del blueprint
**Flujo principal**:
1. El usuario envía petición POST indicando ID del blueprint a usar
2. Proporciona nombre para la nueva lista y tienda de destino
3. El sistema valida que el blueprint pertenezca al usuario
4. Se crea nueva lista con la estructura del blueprint
5. Se copian todos los productos con sus categorías y cantidades
6. Se adaptan categorías a la tienda seleccionada si es necesario
7. Se devuelve la nueva lista creada con código 201
**Alternativos**:
- Blueprint no pertenece al usuario: Se devuelve error 403 "Sin permisos para usar este blueprint"
- Blueprint no existe: Se devuelve error 404 "Blueprint no encontrado"
- Tienda incompatible: Se crean categorías equivalentes o se dejan productos sin categorizar
- Error en creación: Se devuelve error 500 "Error al crear lista desde blueprint"

## Caso de Uso 24: Impersonar Usuario (Solo Administrador)
**Actor principal**: Usuario administrador
**Flujo principal**:
1. El administrador envía petición POST al endpoint de impersonación
2. Especifica ID o email del usuario objetivo
3. El sistema valida que el usuario actual tenga rol de administrador
4. Se verifica que el usuario objetivo exista
5. Se genera token especial de impersonación con duración limitada
6. Se registra la acción de impersonación en logs de auditoría
7. Se devuelve token de impersonación con datos del usuario objetivo
**Alternativos**:
- Usuario no es administrador: Se devuelve error 403 "Solo administradores pueden impersonar usuarios"
- Usuario objetivo no existe: Se devuelve error 404 "Usuario no encontrado"
- Intento de impersonar otro administrador: Se devuelve error 403 "No se puede impersonar otro administrador"
- Sistema en mantenimiento: Se devuelve error 503 "Impersonación no disponible durante mantenimiento"

## Caso de Uso 25: Finalizar Impersonación
**Actor principal**: Usuario administrador (impersonando)
**Flujo principal**:
1. El administrador envía petición DELETE al endpoint de impersonación
2. Se valida que exista sesión de impersonación activa
3. Se invalida el token de impersonación
4. Se restaura la sesión original del administrador
5. Se registra finalización de impersonación en logs
6. Se devuelve código 204 confirmando finalización
**Alternativos**:
- No hay impersonación activa: Se devuelve error 400 "No hay sesión de impersonación activa"
- Token de impersonación expirado: Se limpia automáticamente y se devuelve código 204

## Caso de Uso 26: Obtener Tiendas Disponibles
**Actor principal**: Usuario autenticado
**Flujo principal**:
1. El usuario envía petición GET al endpoint de tiendas
2. El sistema consulta todas las tiendas disponibles en la base de datos
3. Se incluye información básica de cada tienda (id, nombre, descripción)
4. Opcionalmente se pueden incluir categorías predefinidas por tienda
5. Se devuelve array de tiendas con código 200
**Alternativos**:
- Sin tiendas registradas: Se devuelve array vacío con código 200
- Error en consulta: Se devuelve error 500 "Error al obtener tiendas"

## Caso de Uso 27: Validar Enlaces de Invitación (Seguridad)
**Actor principal**: Sistema (proceso automático)
**Flujo principal**:
1. El sistema ejecuta proceso periódico de validación de enlaces
2. Se identifican invitaciones con enlaces próximos a expirar
3. Se notifica a propietarios sobre enlaces que expirarán pronto
4. Se marcan como expiradas las invitaciones que superaron tiempo límite
5. Se revocan accesos de enlaces expirados
6. Se actualizan estadísticas de uso de invitaciones
**Alternativos**:
- Error en proceso de limpieza: Se registra error y se programa reintento
- Base de datos no disponible: Se omite ciclo de limpieza y se programa siguiente ejecución

## Caso de Uso 28: Sugerencias Automáticas de Categorías por Tienda (IA)
**Actor principal**: Usuario autenticado
**Flujo principal**:
1. El usuario agrega un producto a una lista que tiene tienda asignada
2. El sistema consulta automáticamente la IA con contexto de tienda específica
3. La IA analiza el producto y sugiere categoría apropiada según layout de la tienda
4. El sistema aplica la categoría automáticamente al producto
5. El usuario ve el producto ya categorizado según estructura real de la tienda
6. Se optimiza la experiencia de compra con ubicaciones precisas
**Alternativos**:
- Lista sin tienda asignada: Se utiliza categorización genérica o se solicita asignación de tienda
- IA no disponible: Se deja producto sin categoría o se usa categorización básica
- Categoría sugerida no existe: Se crea automáticamente o se usa categoría similar
- Error en API de IA: Se registra producto sin categoría para procesamiento posterior
- Usuario modifica categoría: Se aprende preferencia para futuras sugerencias

---

# CASOS DE USO EXTRA - FUNCIONALIDADES AVANZADAS DE IA

## Caso de Uso 29: Categorización Masiva Inteligente
**Actor principal**: Usuario autenticado
**Flujo principal**:
1. El usuario accede a lista con múltiples productos sin categoría
2. Selecciona opción "Categorizar con IA" desde interfaz de lista
3. El sistema envía todos los productos sin categoría a la IA en una sola consulta
4. La IA analiza todos los productos y sugiere categorías apropiadas
5. El sistema aplica automáticamente todas las categorías sugeridas
6. Se muestra resumen: "15 productos categorizados automáticamente"
7. El usuario puede revisar resultados en vista detallada si lo desea
**Alternativos**:
- Error parcial en IA: Se categorizan productos exitosos y se reportan fallidos
- Productos ambiguos: Se asigna categoría más probable con menor confianza
- Sin productos para categorizar: Se informa que todos los productos ya tienen categoría
- Límite de IA excedido: Se procesa por lotes más pequeños automáticamente

## Caso de Uso 30: Análisis Inteligente de Hábitos de Compra
**Actor principal**: Usuario autenticado
**Flujo principal**:
1. El usuario accede a sección "Mis Insights" desde dashboard principal
2. El sistema recopila historial de compras de los últimos 3 meses
3. Se consulta IA para análisis de patrones: frecuencias, tendencias, estacionalidad
4. La IA genera insights personalizados sobre hábitos de compra
5. Se presenta dashboard visual con análisis de frecuencias y optimizaciones
6. El usuario puede explorar recomendaciones específicas generadas
7. Se ofrecen sugerencias de mejora en eficiencia y presupuesto
**Alternativos**:
- Historial insuficiente: Se informa necesidad de más datos y se muestran insights básicos
- Error en análisis IA: Se muestran estadísticas básicas sin análisis avanzado
- Datos inconsistentes: Se filtran automáticamente y se analiza información confiable
- Usuario nuevo: Se ofrecen consejos generales y se motiva a crear más listas

## Caso de Uso 31: Alertas Proactivas de Precios y Ofertas
**Actor principal**: Sistema (worker automático)
**Flujo principal**:
1. El worker del sistema monitorea precios de productos en listas activas
2. La IA detecta cambios significativos de precios (>10% variación)
3. Se generan alertas contextualizadas: "Aceite subió 15% esta semana"
4. El sistema envía notificaciones push/email a usuarios afectados
5. Se incluyen sugerencias de alternativas o recomendaciones de compra
6. El usuario puede actuar sobre la alerta desde la notificación
**Alternativos**:
- Datos de precios no disponibles: Se omite monitoreo para esos productos
- Usuario deshabilitó notificaciones: Se almacenan alertas para consulta posterior
- Error en detección IA: Se usan reglas básicas de detección de cambios
- Muchas alertas simultáneas: Se agrupan en resumen diario/semanal

## Caso de Uso 32: Listas Inteligentes por Ocasión
**Actor principal**: Usuario autenticado
**Flujo principal**:
1. El usuario selecciona "Crear Lista Inteligente" desde menú principal
2. Especifica ocasión del menú predefinido: "Barbacoa familiar", "Cena romántica", etc.
3. Proporciona detalles: número de personas, restricciones dietéticas, presupuesto
4. La IA genera lista completa con productos apropiados para la ocasión
5. Se incluyen cantidades estimadas y categorías organizadas por tienda
6. El usuario revisa y personaliza la lista generada según preferencias
7. Se crea lista funcional lista para usar en compras
**Alternativos**:
- Ocasión no reconocida: Se solicita descripción libre para análisis IA
- Restricciones complejas: Se priorizan restricciones de salud sobre preferencias
- Presupuesto muy limitado: Se sugieren alternativas económicas y productos básicos
- Error en generación: Se ofrece lista base editable manualmente

## Caso de Uso 33: Recomendaciones Contextuales Automáticas
**Actor principal**: Sistema (en tiempo real)
**Flujo principal**:
1. El usuario agrega producto a lista (ej: "Pasta")
2. La IA detecta contexto y analiza productos complementarios frecuentes
3. Se generan sugerencias discretas: "¿Agregar tomate y queso parmesano?"
4. Las sugerencias aparecen como botones de acción rápida en la interfaz
5. El usuario puede aceptar sugerencias individuales con un clic
6. Los productos se agregan automáticamente con categorías apropiadas
7. El sistema aprende de las decisiones para mejorar futuras sugerencias
**Alternativos**:
- Usuario rechaza frecuentemente: Se reduce agresividad de sugerencias
- Producto sin complementarios obvios: No se muestran sugerencias
- Lista específica (ej: solo postres): Se contextualizan sugerencias al tema
- Error en IA: Se usan reglas básicas de productos relacionados
- Límite de sugerencias: Se priorizan las más relevantes según historial