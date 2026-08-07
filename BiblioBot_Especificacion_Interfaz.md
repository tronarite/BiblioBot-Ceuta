# BiblioBot — Especificación de Interfaz

Documento de planning funcional, organizado para servir de base a la implementación con Claude Code. Cubre navegación, pantallas, componentes, modelo de datos, reglas de negocio y casos límite. Los puntos marcados como **[ASUNCIÓN]** son decisiones de diseño tomadas para completar huecos del planning original; deben confirmarse antes o durante el desarrollo.

---

## 0. Resumen del proyecto

BiblioBot es una aplicación web que automatiza la reserva de puestos en las 3 bibliotecas públicas de Ceuta. El sistema oficial de reservas (PatronBase) se scrapea/automatiza por detrás; BiblioBot ofrece una interfaz más cómoda encima, con reservas puntuales y reservas programadas (recurrentes y automáticas).

**Actores:**
- **Usuario**: tiene una cuenta BiblioBot y, opcionalmente, una cuenta PatronBase vinculada (1:1). Hace reservas puntuales y crea programaciones.
- **Administrador**: es también un usuario, pero con acceso a la sección Administración. Crea cuentas BiblioBot para el resto de usuarios (no hay autorregistro) y gestiona configuración global (mensaje del dashboard, horarios extraordinarios).
- **Motor de automatización (bot)**: proceso en segundo plano que ejecuta las programaciones activas contra PatronBase.

**Pestañas principales:** Dashboard · Programaciones · Cuenta (con Administración anidada, solo admin).

---

## 1. Autenticación y primer arranque

**Estado A — sin ningún usuario registrado:**
La pantalla de login muestra, además del formulario normal, la opción "Crear cuenta de administrador". Es el único momento en que este flujo está disponible.

**Estado B — ya existe un administrador:**
La opción de crear administrador desaparece permanentemente. Solo queda login estándar (email + contraseña) para cuentas creadas por el admin. **[ASUNCIÓN]** No hay autorregistro de usuarios normales: todas las cuentas BiblioBot (aparte de la primera admin) las crea el administrador desde el panel.

La comprobación de "existe admin" debe hacerse server-side en cada carga del login (no solo ocultar el botón en cliente), para que no se pueda crear un segundo admin por esa vía una vez exista uno.

---

## 2. Navegación

Estructura de 3 pestañas de nivel superior. "Administración" no es una pestaña de primer nivel: vive dentro de "Cuenta" y solo se renderiza (ni siquiera en el menú) si `usuario.rol == admin`. Proteger también la ruta en servidor, no solo ocultar en UI.

---

## 3. Modelo de datos necesario para soportar la interfaz

Entidades mínimas que las pantallas descritas más abajo requieren:

**Usuario (cuenta BiblioBot)**
`id, nombre, email, password_hash, rol (admin | usuario), fecha_creacion, patronbase_account_id (FK, nullable, única — 1:1)`

**CuentaPatronBase**
`id, usuario_id, credenciales (usuario/token cifrado), estado_vinculacion, ultima_sincronizacion`

**Biblioteca**
`id, nombre, reglas_especiales (estructura para excepciones como "sin reservas domingo")`
**[ASUNCIÓN]** Nombres reales de las 3 bibliotecas de Ceuta a confirmar (el planning solo nombra "Adolfo Suárez" explícitamente); usar placeholders configurables hasta tener los 3 nombres exactos y sus plantas reales extraídas de PatronBase.

**Planta**
`id, biblioteca_id, numero/nombre, reglas_especiales (ej. "cerrada sábado mañana")`

**Turno**
`id, planta_id, tipo (mañana | tarde), horario`

**Asiento**
`id, planta_id, codigo/posicion_mapa, tipo_asiento`

**Reserva**
`id, usuario_id, biblioteca_id, planta_id, asiento_id, turno_id, fecha, estado (en_curso | proxima | cancelada | fallida), origen (manual | programacion), programacion_id (nullable), created_at`

**Programacion**
`id, usuario_id, biblioteca_id, planta_id, turnos (mañana/tarde/ambos), tipo (n_reservas | hasta_fecha | indefinida), valor_tipo (numero o fecha, según tipo), dias_semana (array L-D), asiento_preferido_id, asiento_alternativo_id, estado (activa | pausada | finalizada), contador_reservas_realizadas, proxima_ejecucion, created_at`

**ActividadLog**
`id, usuario_id, programacion_id (nullable), tipo_evento (reserva_exitosa | reserva_fallida | reintento | puesto_retirado | otro), mensaje, fecha`

**MensajeDashboard**
`id, texto, autor_id, fecha_actualizacion`

**HorarioExtraordinario**
`id, biblioteca_id, fecha, descripcion, horario, autor_id`

---

## 4. Pestaña Dashboard

### 4.1 Reservas en curso y próximas
Dos listados (o dos secciones dentro de una card): "En curso" y "Próximas". Cada elemento muestra biblioteca, planta, turno, asiento, fecha/hora y estado. Estado vacío propio para cada lista ("No tienes reservas en curso", etc.).

### 4.2 Estado de ocupación de las 3 bibliotecas
Una tarjeta por biblioteca (3 en total) con 4 estados posibles, calculados a partir de la disponibilidad scrapeada de hoy y mañana:

1. **Disponible hoy y mañana**
2. **Disponible solo hoy**
3. **Disponible solo mañana**
4. **No disponible ni hoy ni mañana** → en este caso, mostrar el próximo día disponible y la hora a partir de la cual lo estará.

Cada estado necesita una variante visual distinta (color/badge) para que se distinga de un vistazo. **[ASUNCIÓN]** Este estado es por biblioteca en conjunto, no por planta individual (el planning dice "las 3 bibliotecas"); si se necesita granularidad por planta, es una extensión del mismo componente.

### 4.3 Botón "Hacer una reserva" → asistente de reserva puntual

Al pulsar el botón se abre un panel que ocupa toda la superficie de BiblioBot (no un modal pequeño). Layout de dos zonas:

- **Barra lateral derecha, fija**: resumen en vivo de la selección en curso (biblioteca → turno → día → asiento). Cada paso aparece relleno según se va eligiendo; los pasos ya completados son clicables para volver atrás y editarlos sin perder el resto de la selección.
- **Zona principal (izquierda/centro)**: el asistente paso a paso.

**Paso 1 — Biblioteca y turno:** las 3 bibliotecas visibles como tarjetas/opciones, cada una mostrando sus turnos disponibles (mañana/tarde). Bibliotecas o turnos no reservables por reglas de negocio (ver §5.3) aparecen deshabilitados con explicación (ej. "Adolfo Suárez no admite reservas los domingos").

**Paso 2 — Día:** tras elegir biblioteca (y turno), se muestran solo los días realmente disponibles según los datos scrapeados, como selector de fecha/calendario.

**Paso 3 — Mapa de asientos:** se muestra el mapa extraído directamente de la web de PatronBase. Al pasar el ratón sobre una casilla, debajo del mapa aparece de forma clara **[tipo de asiento]** y **[identificador/lugar]** correspondiente a esa casilla. Al hacer clic se selecciona el asiento.

**Paso 4 — Confirmación:** resumen final (ya reflejado también en la barra lateral) y botón de confirmar. Tras confirmar, cierre del panel y actualización de "próximas reservas" en el dashboard.

Cerrar el panel en cualquier punto descarta la selección sin confirmar.

### 4.4 Horarios extraordinarios
Recuadro visible en el dashboard que lista horarios extraordinarios activos o próximos, por biblioteca (fecha + descripción/horario). Si no hay ninguno, el recuadro se oculta o muestra un estado vacío discreto. Editable únicamente desde Cuenta → Administración (CRUD de `HorarioExtraordinario`); en el dashboard es solo lectura.

---

## 5. Pestaña Programaciones

### 5.1 Listado de programaciones
Tabla o tarjetas con las programaciones del usuario: biblioteca, planta, turno(s), tipo, estado, próxima ejecución, contador de reservas realizadas. Acciones por fila: pausar/reanudar, editar, eliminar, ver historial (enlaza a Actividad, filtrado por esa programación).

### 5.2 Crear programación
Mismo patrón de panel a pantalla completa que la reserva puntual (§4.3), adaptado:

**Paso 1 — Biblioteca y planta:** selector de biblioteca y, dentro de ella, planta.

**Paso 2 — Turnos:** mañana, tarde, o ambos (selección múltiple).

**Paso 3 — Tipo de programación:**
- *Nº de reservas antes de pausar*: campo numérico.
- *Reservar hasta un día concreto*: selector de fecha.
- *Indefinida, hasta cancelación manual*: **[ASUNCIÓN]** tercer modo añadido para cubrir "u otro modo que veas adecuado"; se pausa/cancela solo cuando el usuario lo hace explícitamente.

**Paso 4 — Días de la semana:** selección múltiple L-D de los días en que la programación debe intentar reservar. Los días/turnos inválidos según la biblioteca y planta elegidas se deshabilitan dinámicamente con tooltip explicativo (ver reglas en §5.3).

**Paso 5 — Asiento preferido y alternativo:** mismo componente de mapa que en la reserva puntual, pero pidiendo dos selecciones etiquetadas claramente "Opción 1 (preferida)" y "Opción 2 (alternativa)". La opción 2 se usa automáticamente si la 1 no está disponible en el momento de ejecutar la reserva.

**Paso 6 — Resumen y confirmación:** crea la programación en estado "activa".

### 5.3 Reglas de negocio a validar (en el asistente y en el motor)
- **Adolfo Suárez**: no se puede reservar sábado por la tarde ni domingo (ningún turno).
- **Planta 5** (de la biblioteca que corresponda): cerrada los sábados por la mañana. **[ASUNCIÓN]** A confirmar si esta regla aplica solo a una biblioteca concreta o a toda planta 5 que exista en cualquiera de las 3; el planning no lo especifica y debe verificarse contra PatronBase real.
- Estas reglas deben aplicarse dos veces: al construir el formulario (deshabilitando opciones inválidas) y como validación defensiva en el motor antes de cada intento de reserva, por si las reglas de la biblioteca cambian.

### 5.4 Ejecución del motor de programaciones
- Cada programación se dispara justo en el instante en que PatronBase abre el hueco de reservas correspondiente (para "pillar sitio" cuanto antes).
- Si el intento inicial falla (por ejemplo, la web tarda en abrir o hay una condición de carrera), el motor reintenta automáticamente pasado un breve margen. **[ASUNCIÓN]** 1 minuto tras el intento inicial, tal como sugiere el propio planning ("o algo que pruebe un minuto dsp"); dejar este valor como configuración, no hardcodeado.
- Cada intento (éxito, fallo, reintento) se registra en `ActividadLog`.

### 5.5 Pérdida de asiento — dos escenarios distintos
1. **Durante el intento de reserva** (el asiento preferido ya no está libre en el momento de ejecutar): el motor prueba automáticamente el asiento alternativo configurado. Si tampoco está disponible, la reserva se marca como fallida y se registra en el log.
2. **Después de una reserva ya confirmada** (PatronBase retira el puesto tras haberlo confirmado BiblioBot): no hay reintento ni alternativa automática. Se registra el error y se notifica al usuario vía Actividad. Comportamiento explícito pedido: "si ya le quitaron el sitio que dé error y ya".

---

## 6. Pestaña Cuenta

### 6.1 Datos de la cuenta BiblioBot
Ver y editar nombre, email y contraseña.

### 6.2 Cuenta PatronBase vinculada
Formulario para vincular las credenciales de PatronBase. Solo se permite una cuenta PatronBase por usuario BiblioBot (relación 1:1). Mostrar estado (vinculada / no vinculada) y permitir desvincular/revincular. Mientras no haya cuenta PatronBase vinculada, bloquear la creación de reservas y programaciones, mostrando una llamada a la acción para vincularla primero.

### 6.3 Actividad
Listado cronológico de la actividad del bot para ese usuario: reservas programadas ejecutadas con éxito, fallos, reintentos, pausas de programación, etc. Filtrable por tipo y por fecha; reutiliza `ActividadLog`.

### 6.4 Administración (solo admin, dentro de Cuenta)
Visible y accesible únicamente si `rol == admin` (oculto en menú y bloqueado en ruta para el resto).

- **Gestión de cuentas BiblioBot**: crear cuentas para usuarios (nombre, email, contraseña temporal, rol), listar cuentas existentes, activar/desactivar, resetear contraseña, eliminar.
- **Mensaje del dashboard**: editor de texto libre que se muestra a todos los usuarios en el dashboard; guarda autor y fecha de última edición.
- **Horarios extraordinarios**: CRUD completo (biblioteca, fecha, descripción/horario) — alimenta el recuadro de §4.4.

---

## 7. Componentes reutilizables

- **AssistantFullScreenPanel**: panel de pantalla completa de dos columnas (contenido + resumen lateral), parametrizable para modo "reserva puntual" o "crear programación", ya que comparten estructura (biblioteca → [planta] → turno/día → mapa de asientos → confirmación).
- **SummarySidebar**: resumen lateral vivo, con pasos editables/clicables.
- **SeatMapViewer**: renderiza el mapa scrapeado de PatronBase; al hacer hover sobre una casilla, emite tipo de asiento + identificador para mostrarlos debajo del mapa. Debe soportar modo de selección simple (reserva puntual) y modo de selección doble/etiquetada (preferido + alternativo, en programaciones).
- **AvailabilityBadge**: 4 variantes de estado descritas en §4.2.
- **ActivityLogList / ActivityLogItem**.
- **ScheduleCard**: tarjeta de programación con acciones rápidas.
- **ExtraordinaryScheduleBanner**: recuadro de horarios extraordinarios (lectura en dashboard, edición en admin).

---

## 8. Estados vacíos, errores y validaciones

- Sin cuenta PatronBase vinculada → bloquear reservas/programaciones, CTA a Cuenta.
- Sin programaciones creadas → estado vacío con CTA a crear la primera.
- Fallo al cargar el mapa de asientos (error de scraping) → mensaje de error con opción de reintentar, sin bloquear el resto del panel si es posible.
- Asiento ya no disponible al confirmar una reserva puntual (carrera con otro usuario o con PatronBase) → error claro, vuelta al paso de selección de asiento sin perder el resto de la selección.
- Fallo general de scraping/conectividad con PatronBase → aviso global (banner), diferenciado de un fallo puntual de una reserva.
- Intento de crear una programación con combinación biblioteca/planta/turno/día inválida → debe ser imposible desde la UI (opciones deshabilitadas), no solo validado al guardar.

---

## 9. Puntos abiertos a confirmar antes o durante el desarrollo

- Nombres reales y número de plantas de las 3 bibliotecas de Ceuta.
- Alcance exacto de la regla "planta 5 cerrada sábado mañana" (¿una biblioteca o todas las que tengan planta 5?).
- Hora exacta de "apertura de reservas" por biblioteca/turno (para disparar el motor) y si es la misma para las 3.
- Política de reintentos definitiva (número de intentos, intervalo) más allá del "1 minuto después" sugerido.
- Método de autenticación contra PatronBase para el scraping (usuario/contraseña reales, si hay 2FA, límites de peticiones).
