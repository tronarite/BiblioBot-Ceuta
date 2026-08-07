# Análisis del sistema de reservas — Red de Bibliotecas Públicas de Ceuta

**Fecha del análisis:** 07 de agosto de 2026
**URL base:** `https://es.patronbase.com/_BibliotecaCeuta/`
**Plataforma:** PatronBase (SaaS de gestión de entradas/eventos, reutilizado aquí como sistema de cita previa para puestos de estudio)
**Cuenta usada para el análisis:** marcelo.ananga@tronarite.net (259 reservas históricas registradas)

> **Nota metodológica:** este análisis se hizo iniciando sesión con las credenciales proporcionadas y navegando el flujo real de reserva hasta el último paso ("Completar el Pedido"), sin llegar a confirmar ninguna reserva — la cesta se vació antes de finalizar para no dejar ningún puesto retenido ni generar una reserva ficticia.

---

## 1. Naturaleza del sistema

A pesar de llamarse "Productions" en la URL (nomenclatura propia de PatronBase para "eventos"/"funciones"), el sistema **no gestiona préstamo de libros**, sino **reserva de puestos de estudio / cita previa** en las salas de las bibliotecas públicas de Ceuta. Cada "producción" es en realidad una sala + turno horario, y cada "función"/"performance" es un día concreto dentro de esa sala.

### Centros disponibles
| Biblioteca | Salas/plantas ofertadas | Turnos |
|---|---|---|
| BP "Adolfo Suárez" | Planta 3ª, 4ª y 5ª | Mañana / Tarde |
| BP "El Morro" | Planta 0 y Planta 1ª | Mañana / Tarde |
| BP "Estación del Ferrocarril" | Sala única | Mañana / Tarde |

Cada combinación sala+turno es una entidad reservable independiente (ej. `B.P. "Adolfo Suárez" P. 5ª MAÑANA 2026-2`), con su propio calendario, aforo y mapa de asientos.

### Horarios generales observados
- **Mañana:** 09:00–15:00 (sábados 09:00–14:00), salvo Estación del Ferrocarril / El Morro que usan 9:00–15:00 / 9:00–14:00 sábados.
- **Tarde:** 15:00 hasta la hora de cierre (variable según sede; El Morro y Estación del Ferrocarril: hasta las 21:00).
- Servicio **gratuito** en todos los casos (0,00 €, tarifa única "Invitación").

---

## 2. Flujo de reserva (wizard de 5 pasos)

La interfaz guía al usuario por una barra de progreso fija: **1) Elige Biblioteca → 2) Elige día → 3) Elige asientos → 4) Elige tarifa → 5) Tramitar pedido**.

### Paso 1 — Elige Biblioteca (`/Productions`)
Página pública (no requiere login para verla) que lista las 3 bibliotecas como filtro rápido y, debajo, una tarjeta por cada sala/turno con:
- Nombre de la sesión (ej. `B.P. "Adolfo Suárez" P. 5ª TARDE 2026-2`)
- Horario detallado de esa sesión
- Rango de fechas en que la sesión existe (normalmente todo el año natural, ej. "19 de ene – 31 de dic de 2026")
- Sala física asociada
- Precio (siempre "Servicio gratuito sin coste: 0,00 €")
- Botón **"Reservar ahora"**

Al pulsar "Reservar ahora" se entra en la URL interna de la producción (ej. `/Productions/KK/Performances`, donde `KK` es el identificador corto de esa sala+turno).

### Paso 2 — Elige día (`/Productions/{id}/Performances`)
Lista de días disponibles como opciones de radio button, cada uno con su hora de sesión (ej. "14:00" para el turno de tarde/apertura de cita).

**Hallazgo clave — ventana de reserva deslizante ("rolling window"):**
Solo está habilitado para reservar el **día actual** (siempre) y, a partir de cierta hora, el **día siguiente**. El resto de días futuros aparecen listados pero deshabilitados con el texto:

```
lunes, 10 de agosto   No estará disponible hasta el 9 de ago de 2026, 07:00
```

Es decir, cada día se "desbloquea" para reserva **el día anterior a las 07:00**. Esto implica que un usuario nunca puede reservar con más de ~1 día de antelación, y que la apertura diaria de cupo ocurre siempre a las 07:00.

Debajo del selector de días se repite el precio (Invitación 0,00 €).

### Paso 3 — Elige asientos (`/Seats/ChooseMyOwn?prod_id=...&perf_id=...&section_id=...&seat_type_id=S`)
Mapa visual interactivo de la sala, renderizado como una cuadrícula de "asientos" coloreados:
- **Verde:** asiento libre, seleccionable.
- **Negro:** asiento ocupado/no disponible.
- **Azul:** asiento seleccionado por el usuario actual en ese momento.

Al pasar/clicar sobre un asiento aparece un tooltip identificador, ej.:
```
SALA DE ESTUDIOS fila 3, asiento 2
```
Esto confirma que cada plaza física tiene una identidad única (sala + fila + número), consistente con la norma publicada: *"Las plazas en las salas se asignan con un número específico [...] no será posible cambiar de plaza una vez asignada."*

Controles de zoom "Reducir" / "Ampliar" para ver mejor el plano en salas grandes.

Botón para continuar: **"Confirmar Asientos"**.

### Paso 4 — Elige tarifa / Cesta (`/Cart/Show`)
En la práctica, como solo existe una tarifa (Invitación, 0,00 €), este paso se resuelve automáticamente al confirmar asientos y lleva directo a la vista de cesta ("Has seleccionado:"). Aquí se observa:

- **Temporizador de retención de plaza:** contador regresivo visible ("Tiempo restante: 14:44" en la prueba realizada). Mientras el artículo está en la cesta, el asiento queda bloqueado para otros usuarios durante ~15 minutos; si no se completa la compra en ese plazo, se libera automáticamente.
- Resumen: sala, fecha/hora, asiento asignado, tipo de tarifa y precio.
- Opciones: **"Vaciar la cesta"** (`/Cart/RemoveAll`), campo de código de descuento/vale (sin uso aparente al ser gratuito), y **"Completar el Pedido"**.
- Aviso: *"Al finalizar el proceso de compra debe llegarte un email con tus entradas en PDF. Si no recibes las entradas, revisa tu carpeta de spam."*

### Paso 5 — Tramitar pedido
(No se llegó a ejecutar en este análisis para no generar una reserva real.) Según el texto de la propia web, al completar el pedido:
1. Se genera la reserva definitiva con número de compra (ID de venta).
2. Se envía automáticamente un **email con el billete/justificante en PDF**.
3. Ese PDF ("Impresión a Domicilio") es el documento que hay que presentar físicamente para acceder a la sala reservada, según indican las "Normas Importantes" de la página principal.

---

## 3. Normas y políticas publicadas (texto literal de la web)

> **Normas Importantes que debes conocer:**
> 1. Las plazas en las salas se asignan con un número específico. Por favor, respeta esta asignación ya que no será posible cambiar de plaza una vez asignada.
> 2. Para ingresar a las salas, será necesario presentar el justificante que la aplicación de cita previa envía a tu correo electrónico.

> **Anulación de Citas:**
> Se puede cancelar por email (BibliotecaPublica@ceuta.es), por teléfono (956 513 074) o por WhatsApp (629207667 / 626147684), indicando el número de reserva.

> **Contacto de soporte general:** BibliotecaPublica@ceuta.es / 956 51 30 74.

No se identificó en la interfaz ningún botón de autocancelación desde la zona personal (`Historial de Compras` / `Ver Compra`) — la cancelación parece gestionarse manualmente por el personal de la biblioteca a partir del número de reserva.

---

## 4. Zona personal ("Tu Biblioteca")

Tras iniciar sesión (`Email` + `Contraseña` + botón "Iniciar Sesión" en la propia home de `/Productions`), el panel lateral pasa de mostrar el formulario de login a un bloque de bienvenida:

```
TE DAMOS LA BIENVENIDA
Hola {Nombre} {Apellidos}
› Tus Datos
› Historial de Compras
› Opciones de Privacidad
Desconecta
```

### 4.1 Tus Datos (`/Patron/Details`)
Formulario editable ("Modifica tus datos") con los datos personales del titular:
- Email
- Nombre y apellidos
- Teléfono
- Dirección postal completa (calle, ciudad, código postal, país)
- Género y fecha de nacimiento (opcionales, sin rellenar en esta cuenta)
- **DNI**
- Contador resumen: *"Has efectuado un total de N compras con nosotros"*, con acceso directo al historial.

### 4.2 Historial de Compras (`/Patron/SalesHistory`) — equivalente al "historial de reservas"
Es la sección que el usuario identificó como "historial de compras = historial de reservas", dado que todas las "compras" en este sistema son en realidad reservas de puesto (precio 0,00 €). Estructura:

- **Agrupación por año** con contador de reservas por año. En la cuenta analizada:
  | Año | Nº de reservas |
  |---|---|
  | 2026 | 110 |
  | 2025 | 104 |
  | 2024 | 45 |
  | **Total** | **259** |

- **Tabla cronológica descendente** con columnas:
  - `Nº de Compra` (ID de venta, enlaza al detalle)
  - `Fecha` (día completo en español)
  - `Información` (descripción: nº de asientos + sala/turno; si el mismo día se reservó mañana y tarde, aparecen ambas líneas en la misma fila de compra)
  - `Sale Total` (siempre 0,00 €)

- **Patrón de uso detectado en la muestra:** reservas casi diarias (frecuentemente mañana **y** tarde el mismo día), concentradas mayoritariamente en `B.P. "Adolfo Suárez" P. 5ª`, con uso puntual de la 4ª planta y, en una ocasión, de "El Morro" P. 1ª TARDE. El comportamiento sugiere un uso recurrente tipo "puesto fijo de estudio" más que visitas esporádicas.

### 4.3 Detalle de una compra (`/Patron/ViewSale?sale={ID}`)
Cada reserva individual expone:
- ID de venta
- Fecha y hora exacta en que se realizó la reserva (no la fecha de la cita, sino el timestamp de la transacción)
- Sesión reservada, con fecha/hora de la cita y sala
- Línea de producto: `1 x Invitación @ 0,00 € each = 0,00 €`
- **Asiento asignado**, con el mismo formato visto en el mapa: `1 seats (SALA GENERAL Fila 5 - Asiento 24)`
- Total: 0,00 €
- **Reenvío de recibo:** campo para reenviar el justificante a un email alternativo
- **"Imprimir PDF de las entradas"** (Impresión a Domicilio): descarga el mismo justificante que se exige para acceder a la sala.

### 4.4 Opciones de Privacidad
Enlace presente en el menú, no explorado en profundidad en este análisis (fuera del alcance solicitado).

---

## 5. Estructura técnica observada (URLs / endpoints)

| Función | Endpoint |
|---|---|
| Listado de salas/turnos reservables | `GET /_BibliotecaCeuta/Productions` |
| Login (formulario embebido en la home) | `POST` sobre `/_BibliotecaCeuta/Productions` |
| Selección de día para una sala | `GET /_BibliotecaCeuta/Productions/{prod_id}/Performances` |
| Selección de asiento | `GET /_BibliotecaCeuta/Seats/ChooseMyOwn?prod_id={id}&perf_id={id}&section_id={id}&seat_type_id=S` |
| Ver/editar cesta | `GET /_BibliotecaCeuta/Cart/Show` |
| Vaciar cesta | `GET /_BibliotecaCeuta/Cart/RemoveAll` |
| Datos del titular | `GET /_BibliotecaCeuta/Patron/Details` |
| Historial de reservas | `GET /_BibliotecaCeuta/Patron/SalesHistory` |
| Detalle de una reserva concreta | `GET /_BibliotecaCeuta/Patron/ViewSale?sale={ID}` |

Los identificadores de venta (`sale=`) son numéricos secuenciales globales de la plataforma (no solo de esta cuenta), lo que sugiere que son correlativos entre todos los usuarios del sistema — un detalle a tener en cuenta desde el punto de vista de privacidad/seguridad si esos IDs no están correctamente protegidos por control de acceso (no se probó el acceso a ventas de terceros, ya que queda fuera del alcance ético de este análisis).

---

## 6. Resumen de hallazgos clave

1. **No es un sistema de préstamo bibliotecario**, sino de reserva de puestos de estudio con cupo por asiento numerado.
2. **Ventana de reserva muy corta**: solo se puede reservar hoy o mañana (apertura diaria a las 07:00), lo que fuerza a los usuarios recurrentes a reservar casi a diario.
3. **Retención temporal de cesta (~15 min)** antes de expirar automáticamente si no se completa el pedido.
4. **Justificante en PDF por email** obligatorio para el acceso físico a la sala.
5. El **"Historial de Compras"** es, en efecto, el historial completo de reservas del usuario, con detalle por reserva (fecha, sala, asiento exacto) y descarga del justificante en cualquier momento posterior.
6. Los datos personales accesibles vía "Tus Datos" incluyen **DNI, teléfono y dirección completa**, además de email — información sensible que conviene tratar con cuidado si se automatiza cualquier proceso sobre esta cuenta.
7. No se encontró opción de autocancelación online; la cancelación de citas requiere contacto directo (email/teléfono/WhatsApp) indicando el número de reserva.

---

## 7. Posibles líneas de trabajo derivadas (no ejecutadas)

- Automatizar la reserva diaria del puesto habitual (dado el patrón de 259 reservas), respetando la ventana de apertura a las 07:00.
- Exportar el historial completo de compras a CSV/JSON para análisis de ocupación propia a lo largo del tiempo.
- Monitorizar la disponibilidad de asientos en tiempo real en la sala/turno preferido para alertar en cuanto se abra el cupo del día siguiente.
