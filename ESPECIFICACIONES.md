# Especificaciones funcionales y técnicas — Octubre Rosa

**Versión:** 1.0  
**Tipo de proyecto:** Aplicación web móvil (responsive)  
**Objetivo:** Juego educativo con preguntas sobre concientización del cáncer de mama, respondidas mediante tarjetas de tipo «raspa y gana», con estadísticas compartidas entre múltiples celulares.

## 1. Resumen

El participante abre la aplicación desde un enlace o un código QR, inicia una partida y responde **tres preguntas**, cada una con **tres opciones**. La opción se elige raspando su cobertura con el dedo (o mouse). Al descubrir el umbral definido, la opción queda seleccionada y las restantes se bloquean. Al terminar las tres preguntas, la partida es **correcta únicamente si las tres respuestas son correctas**; de lo contrario, es **incorrecta**.

Cada partida terminada se registra **una sola vez** en una base de datos central, para que las estadísticas acumulen participaciones provenientes de todos los celulares.

## 2. Alcance del MVP

### Incluido

- Página de bienvenida con identidad visual de Octubre Rosa y botón **Comenzar**.
- Tres preguntas por partida, con tres alternativas en cada pregunta.
- Efecto visual de raspado con **HTML Canvas**, compatible con pantalla táctil y mouse.
- Selección irreversible de una sola alternativa por pregunta una vez alcanzado el umbral de raspado.
- Avance entre preguntas y pantalla de resultado final.
- Registro remoto de partidas finalizadas como **correcta** o **incorrecta**.
- Contadores globales de partidas correctas, incorrectas y total de partidas completadas.
- Diseño móvil, accesible y con una alternativa al gesto de raspar.
- Publicación por URL HTTPS y acceso por código QR.

### Fuera del MVP

- Aplicaciones nativas de Android o iOS.
- Registro de usuarios, nombres, correos o identificación personal.
- Premios, sorteos, premios físicos o recompensas monetarias.
- Clasificaciones por participante o seguimiento entre dispositivos.
- Edición de preguntas desde una interfaz administrativa (se configuran en el proyecto).

## 3. Reglas de negocio

**RN-01.** Una partida contiene exactamente tres preguntas.

**RN-02.** Cada pregunta muestra tres opciones y tiene exactamente una respuesta correcta.

**RN-03.** El usuario responde **raspando la tarjeta de la opción elegida**. Cuando el área descubierta alcanza el umbral establecido (valor inicial recomendado: 40 %), la respuesta se confirma. Se bloquea el raspado de las otras dos opciones.

**RN-04.** No es posible cambiar una respuesta confirmada dentro de la misma partida.

**RN-05.** Se avanza a la siguiente pregunta después de confirmar la respuesta actual. Para reforzar el aprendizaje, se puede mostrar una breve explicación de la respuesta correcta; no se modifica el resultado de la partida.

**RN-06.** Una partida es **correcta** si y solo si las tres respuestas son correctas (3/3). Las combinaciones 0/3, 1/3 y 2/3 cuentan como **incorrecta**.

**RN-07.** Solo se registran en las estadísticas las partidas **finalizadas**. Si el usuario cierra el navegador a mitad del juego, esa partida no se suma.

**RN-08.** Cada partida finalizada debe contar **una sola vez**, aunque el usuario recargue la página, reintente el envío o tenga una conexión intermitente.

**RN-09.** Una nueva partida comienza desde cero y recibe un identificador único nuevo; se admite que una persona juegue varias veces. Los contadores reflejan **partidas**, no personas únicas.

**RN-10.** Las preguntas y respuestas correctas se validan en el servidor para impedir que un cliente alterado envíe libremente el resultado `correcta=true`.

**RN-10.** Las preguntas y respuestas deben estar aleatoriamente ordenadas.

## 4. Pantallas y navegación

1. **Inicio:** título «Octubre Rosa», mensaje educativo breve, botón «Comenzar» y, opcionalmente, enlace a información confiable.
2. **Juego:** indicador de progreso «Pregunta 1 de 3», texto de la pregunta, tres tarjetas raspables y una indicación de uso. Tras confirmar la respuesta, muestra la alternativa elegida, la correcta y una explicación breve; habilita «Siguiente».
3. **Resultado:** mensaje «¡Completaste las 3 preguntas!» y estado de la partida: «3 de 3 correctas» o «Partida incorrecta». Botón «Volver a jugar».
4. **Estadísticas generales:** vista separada, preferiblemente protegida para los organizadores, con **total de partidas completadas**, **correctas**, **incorrectas** y **porcentaje de partidas correctas**. No mostrar datos personales.

**Flujo:** Inicio → Pregunta 1 → Pregunta 2 → Pregunta 3 → Envío del resultado → Resultado final → Nueva partida (opcional).

## 5. Requisitos de interfaz

- **Mobile-first**: funcionar en pantallas pequeñas sin desplazamiento horizontal.
- Colores vinculados a Octubre Rosa, con contraste suficiente para leer las preguntas.
- Tarjetas grandes, separadas y fáciles de raspar con un dedo.
- El `canvas` constituye una capa que se borra con `globalCompositeOperation = 'destination-out'`.
- Usar eventos `pointerdown`, `pointermove`, `pointerup` y `pointercancel`, y `touch-action: none` en las tarjetas.
- Verificar el porcentaje efectivamente borrado mediante muestreo del canal alfa del canvas, en lugar de contar solo la distancia recorrida por el dedo.
- Un gesto sobre otra tarjeta antes de alcanzar el umbral **no** confirma respuesta; al alcanzar el umbral en una opción, las demás se deshabilitan.
- Incluir un mecanismo alternativo accesible para elegir una respuesta sin arrastrar el dedo, por ejemplo un botón «Seleccionar esta opción» por alternativa.
- Respetar la preferencia `prefers-reduced-motion`.
- No depender únicamente del color para comunicar aciertos y errores.

## 6. Contenido educativo inicial (editable)

> El contenido debe ser revisado por el organizador o por un profesional de salud antes de publicarse. Es material de concientización, no una herramienta de diagnóstico.

**Pregunta 1.** ¿El cáncer de mama puede afectar también a los hombres?
- A. Sí. **(Correcta)**
- B. No.
- C. Solo a partir de los 80 años.
- Explicación: Aunque es mucho menos frecuente, los hombres también pueden desarrollar cáncer de mama.

**Pregunta 2.** ¿Por qué es importante detectar el cáncer de mama a tiempo?
- A. Porque garantiza que nunca habrá tratamiento.
- B. Porque permite iniciar una evaluación y tratamiento oportunos. **(Correcta)**
- C. Porque elimina la necesidad de consultar al personal de salud.
- Explicación: La detección temprana puede mejorar las opciones de atención y los resultados.

**Pregunta 3.** ¿Qué mes se dedica internacionalmente a la concientización sobre el cáncer de mama?
- A. Marzo.
- B. Julio.
- C. Octubre. **(Correcta)**
- Explicación: Octubre se utiliza para difundir información y promover la concientización sobre el cáncer de mama.

## 7. Arquitectura propuesta

**Frontend:** HTML5 + CSS3 + JavaScript (vanilla), sin frameworks obligatorios.  
**Hosting:** Cloudflare Pages o GitHub Pages para la web estática.  
**Backend + base de datos:** **Supabase** (PostgreSQL + Edge Function o endpoint de servidor).  
**Acceso:** enlace HTTPS y código QR.

```text
Celular A ─┐
Celular B ─┼─> Web HTML/CSS/JS ──HTTPS──> Endpoint del backend ──> PostgreSQL (Supabase)
Celular C ─┘                                      │
                                       Estadísticas globales
```

La lógica de validación y persistencia debe ejecutarse en el backend. El navegador muestra la interacción, pero **no** decide por sí solo qué partidas son correctas en la base central.

## 8. Modelo de datos mínimo

### Tabla `game_sessions`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID, clave primaria | Identificador único de partida generado al comenzar |
| `question_set_version` | texto | Versión de las preguntas utilizadas |
| `correct_count` | entero (0–3) | Respuestas correctas |
| `is_correct` | booleano | `true` solo si `correct_count = 3` |
| `completed_at` | timestamp con zona horaria | Fecha/hora de finalización |

**Recomendación de seguridad:** no permitir INSERT ni UPDATE directos y sin control desde el navegador sobre esta tabla. El servidor registrará únicamente partidas verificadas. Nunca exponer claves secretas o `service_role` en el frontend.

### Estadísticas agregadas

- `total = COUNT(*)`
- `correctas = COUNT(*) FILTER (WHERE is_correct = true)`
- `incorrectas = COUNT(*) FILTER (WHERE is_correct = false)`
- `porcentaje_correctas = correctas / total * 100` (si `total > 0`; en caso contrario, 0)

## 9. API y validación recomendada

Para un contador público fiable, no confiar en un booleano enviado directamente por JavaScript.

### `POST /api/start`

- Crea una nueva partida y devuelve su `session_id`, el conjunto de preguntas y tres opciones por pregunta **sin incluir la respuesta correcta**.
- Guarda en el servidor un estado de partida iniciado con su vencimiento.

### `POST /api/finish`

- Entrada: `session_id` y tres índices de respuesta (uno por pregunta).
- Comprueba que la partida existe, que no expiró, que no fue completada y que las respuestas cumplen el formato esperado.
- Recalcula los aciertos usando las respuestas oficiales almacenadas en el servidor.
- Registra la partida terminada en una transacción, de forma idempotente; una repetición del mismo envío no aumenta el contador.
- Salida: cantidad de aciertos, resultado final y, si se desea, explicaciones de respuestas.

### `GET /api/stats`

- Devuelve los totales globales para la vista de organizadores; proteger el endpoint o restringir su acceso según corresponda.

**Controles adicionales:** límites de solicitudes por IP/ventana temporal, expiración de sesiones no terminadas, controles anti-automatización cuando haga falta y políticas RLS apropiadas. Sin autenticación de participantes **no es posible garantizar** que una persona juegue una sola vez ni impedir por completo los envíos automatizados; el objetivo es evitar duplicados accidentales y manipulación trivial del contador.

## 10. Estados y manejo de errores

- **Cargando:** al iniciar o finalizar una partida, deshabilitar botones para evitar toques repetidos.
- **Sin conexión:** conservar temporalmente en el navegador el `session_id` y las respuestas finales para reintentar el envío de una partida finalizada, sin crear otra.
- **Error del backend:** mostrar «No pudimos guardar tu resultado. Intentá nuevamente» y permitir reintentar.
- **Envío repetido:** devolver el resultado guardado sin sumar otra partida.
- **Sesión vencida:** informar y ofrecer empezar nuevamente; no sumar al contador.
- **Juego interrumpido:** si no se completó, no registrar resultado.

## 11. Estructura sugerida

```text
octubre-rosa/
├── index.html
├── styles.css
├── script.js
├── assets/
│   └── lazo-rosa.svg
├── supabase/
│   ├── migrations/
│   │   └── 001_init.sql
│   └── functions/
│       └── game-api/
│           └── index.ts
└── README.md
```

**Nota:** la ubicación concreta del endpoint/API puede adaptarse al servicio de hosting elegido. Las funciones, migraciones y rutas son una propuesta de organización, no archivos ya implementados.

## 12. Criterios de aceptación

- [ ] La aplicación se abre por HTTPS desde Android e iPhone, sin instalar nada.
- [ ] Se muestran exactamente tres preguntas con tres opciones cada una.
- [ ] Se puede raspar cada opción con un dedo o con un mouse.
- [ ] Solo la primera opción que alcanza el umbral se registra como respuesta de esa pregunta.
- [ ] Las opciones restantes quedan bloqueadas una vez confirmada una respuesta.
- [ ] Es posible completar el juego mediante un método accesible alternativo.
- [ ] **3/3** respuestas correctas → partida correcta.
- [ ] **0/3, 1/3 o 2/3** → partida incorrecta.
- [ ] Una partida incompleta no afecta los contadores.
- [ ] Dos celulares diferentes pueden completar partidas y ambas aparecen en el total global.
- [ ] Reenviar la misma partida no aumenta las estadísticas.
- [ ] Manipular un campo `is_correct` en el navegador no permite falsificar el resultado guardado.
- [ ] Si falla la conexión al finalizar, el usuario puede reintentar sin perder el resultado ni duplicarlo.
- [ ] Los organizadores pueden consultar total, correctas, incorrectas y porcentaje de aciertos.

## 13. Etapas de implementación

1. **Prototipo local:** diseño y tres preguntas con raspado funcional; cálculo del resultado en memoria.
2. **Backend compartido:** esquema Supabase, creación y finalización idempotente de partidas, validación en servidor.
3. **Estadísticas y resiliencia:** contadores generales, reintentos, errores y protecciones básicas.
4. **Publicación y prueba real:** hosting HTTPS, QR y ensayos simultáneos en varios celulares.

## 14. Decisiones tomadas y pendientes

**Definidas:** web móvil; HTML/CSS/JavaScript; tres preguntas por partida; tres opciones raspables; resultado global correcto solo con 3/3; contadores centralizados para todos los celulares; sin registro de participantes en el MVP.

**A definir durante la implementación:** texto e identidad visual definitivos, si se mostrarán las respuestas correctas después de cada pregunta o solo al final, acceso a estadísticas para organizadores, dominio/hosting y medidas antiabuso apropiadas para el evento.
