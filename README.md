# Octubre Rosa

Aplicación móvil educativa basada en `ESPECIFICACIONES.md`.

Juego publicado: https://ojotasi.github.io/octubre-rosa/

## Cómo está organizado el código

Este repositorio contiene el código fuente editable de la interfaz y el servidor. Los archivos publicados se generan automáticamente; no hace falta escribir CSS o JavaScript dentro del HTML.

| Carpeta o archivo | Qué modificar ahí |
| --- | --- |
| `app/globals.css` | Estilos, colores, tamaños y adaptación a celulares. |
| `app/experience.tsx` | Pantallas de inicio, preguntas y resultado. |
| `app/scratch-card.tsx` | Interacción de raspar con Canvas. |
| `app/estadisticas/statistics.tsx` | Panel de estadísticas. |
| `app/icons.tsx` | Iconos y cinta rosa. |
| `github-pages/index.html` y `github-pages/estadisticas.html` | Plantillas HTML de GitHub Pages. |
| `github-pages/main.tsx` y `github-pages/statistics.tsx` | Entradas JavaScript/React de cada pantalla. |
| `github-pages/config.ts` | Dirección pública de la API de Sites; no contiene claves. |
| `lib/questions.ts` | Preguntas, soluciones y explicaciones que usa el servidor. |
| `lib/api.ts` y `app/api/` | Validación de partidas y API. |
| `db/` y `drizzle/` | Esquema de la base de datos y migraciones. |
| `tests/api.test.mjs` | Pruebas de partidas, acceso y estadísticas. |
| `scripts/build-github-pages.mjs` | Genera HTML, CSS y JavaScript separados. |
| `.github/workflows/pages.yml` | Prueba, construye y publica la web automáticamente. |

Las carpetas `components/`, `hooks/`, `build/`, `vendor/` y parte de `scripts/` conservan las utilidades y el entorno del proyecto original de Sites.

## GitHub Pages: construir y publicar

Usar Node.js 24. Para construir la interfaz estática desde una copia del repositorio:

```sh
npm ci
npm test
npm run typecheck
npm run build:pages
```

El resultado se genera en `outputs/github-pages/` (carpeta ignorada por Git):

```text
index.html
estadisticas.html
assets/
  styles-<hash>.css
  game-<hash>.js
  statistics-<hash>.js
  shared-<hash>.js
favicon.svg
acceso-qr.svg
```

Los HTML referencian archivos externos mediante `link` y `script`; los hashes evitan usar versiones antiguas de los recursos después de actualizar. El código original permanece legible en las carpetas anteriores.

En GitHub, **Settings → Pages → Source** debe estar configurado como **GitHub Actions**. Cada cambio enviado a `main` ejecuta las pruebas, comprueba TypeScript, genera los archivos y publica exclusivamente `outputs/github-pages/`. También se puede iniciar desde **Actions → Publicar web en GitHub Pages → Run workflow**. No se necesitan claves de Sites en GitHub Actions.

Las URLs del juego y del panel se mantienen. Para el panel se usa `estadisticas.html#acceso=<clave>`; la clave se comparte por separado y nunca se sube a GitHub.

**La publicación automática actualiza la interfaz de GitHub Pages.** El servidor y la base de datos siguen alojados en Sites. Cambios en `lib/questions.ts`, `lib/api.ts` o el esquema requieren además publicar el servidor en Sites; enviar esos archivos a GitHub solo guarda su código fuente.

## Funcionalidad

- Tres preguntas con tres opciones cada una, ambas en orden aleatorio generado en el servidor.
- Canvas con mouse o dedo; confirmación al borrar el 40% real de su superficie mediante muestreo alfa. Alternativa accesible con botón por opción.
- La selección queda bloqueada en el servidor **antes** de devolver la corrección y explicación de cada pregunta.
- Solo al finalizar las tres preguntas se suma una partida. 3/3 es correcta; 0/3, 1/3 y 2/3 son incorrectas.
- Un único intento por carga de página. Recargar vuelve siempre a la pantalla inicial y permite comenzar una partida nueva. Dentro de una misma carga, volver a solicitar un inicio recupera el mismo intento. No existe botón para volver a jugar.
- UUID por partida. Envíos simultáneos y reintentos de red devuelven el mismo resultado sin duplicarlo.
- Las respuestas y los reintentos se conservan en memoria mientras la pestaña permanece abierta. Una recarga descarta la partida en curso y comienza otra sesión; ya no se restauran partidas anteriores desde el almacenamiento del navegador.
- Estadísticas en un enlace secreto independiente, sin cuentas ni correos vinculados. No se muestra ningún enlace al panel dentro del juego.
- El QR solo contiene la URL inicial de la aplicación. Está en `public/acceso-qr.svg` y puede descargarse desde el panel de la persona encargada. No hay menú de compartir en el juego.
- Diseño móvil, teclado, foco visible y movimiento reducido.

## Arquitectura y acceso

La interfaz pública se aloja en **GitHub Pages** y reutiliza los componentes React del proyecto. El servidor usa **Sites: Vinext/React + Cloudflare Worker + D1 (SQLite)**. El raspado usa Canvas y Pointer Events nativos. La base se aprovisiona mediante el binding `DB` de `.openai/hosting.json` y es compartida entre dispositivos. Esto reemplaza Supabase propuesto originalmente.

Para cumplir el acceso sin cuentas solicitado, el Site permite abrir el juego y el panel por URL, sin iniciar sesión. Las estadísticas requieren el enlace secreto completo: `/estadisticas#acceso=<clave aleatoria de 256 bits>`. Cualquiera que reciba ese enlace puede ver los contadores. No hay enlaces hacia el panel en el juego, el QR ni los recursos públicos. El QR abre solo la página inicial.

La clave se guarda en Sites como variable secreta `STATS_ACCESS_TOKEN`. Nunca se guarda en el código, el bundle público ni este documento. El navegador la toma del fragmento de la URL (no se envía como parte de la ruta o consulta al servidor) y la presenta en la cabecera `Authorization: Bearer …` al consultar estadísticas. La API deniega el acceso si falta la clave, es incorrecta o no está configurada. Las cuentas de ChatGPT no conceden acceso al panel. El panel usa `noindex`, `nofollow` y `no-referrer`; las respuestas de datos usan `no-store`. Para revocar el enlace, cambiar la clave en Sites y desplegar de nuevo.

Cada documento del navegador genera un UUID temporal que envía en `X-Game-Page`. El servidor lo combina con un hash de cuenta o cookie del navegador para asignar un único intento a esa carga de página. Recargar genera otro UUID, incluso cuando la cuenta o la cookie siguen siendo las mismas. No se guardan nombres ni correos de participantes en las partidas. La cookie anónima es HttpOnly, SameSite=Lax y Secure en HTTPS. El comportamiento anterior, sin cabecera de página, se conserva para admitir reintentos de clientes antiguos. El límite antiabuso de inicios usa un hash temporal de la IP.

## API

| Ruta | Uso |
| --- | --- |
| `POST /api/attempt` | Cuerpo `{}` y cabecera `X-Game-Page`. Inicializa la cookie anónima si hace falta y devuelve `{attempt, expired}` para esa carga de página. No se llama automáticamente al cargar el inicio ni adopta partidas previas en la interfaz actual. |
| `POST /api/start` | Cuerpo `{}`. Crea el único intento o devuelve el existente. Responde con el estado de la partida, sin soluciones de preguntas pendientes. |
| `POST /api/answer` | `{sessionId, questionIndex, optionIndex}`. Índices 0–2. Bloquea la selección y devuelve la corrección. Repetirla es idempotente; cambiarla devuelve 409. |
| `POST /api/finish` | `{sessionId, answers: [0,1,2]}`. Valida contra las elecciones bloqueadas, calcula el resultado y lo registra una sola vez. Ignora campos de puntuación del cliente. |
| `GET /api/stats` | Requiere la clave del enlace en `Authorization: Bearer …`; devuelve `total`, `correct`, `incorrect`, `correctPercentage`. No acepta la clave en la consulta de la URL. |

El plazo de una partida es de 24 horas. Dentro de una misma sesión de página no se asigna otro intento; recargar permite comenzar una sesión nueva. Las asignaciones y estadísticas anteriores se conservan. Errores: 410 intento vencido, 409 conflicto o falta de cookie inicial, 400 datos inválidos, 401 estadísticas sin clave válida, 403 sesión no autorizada, 413 cuerpo mayor a 2 KiB, 429 más de 60 inicios por IP por hora. Las partidas completas pueden reenviarse sin duplicarse. Solo se limpian límites antiabuso caducados.

Las actualizaciones condicionales de D1 bloquean elecciones y finalizan partidas de forma atómica. `attempt_claims` asigna una única partida por participante en una transacción, incluso ante inicios concurrentes. Las partidas existentes se conservan; no se borran estadísticas anteriores. No hay escritura directa desde el navegador ni puntuaciones confiadas al cliente.

## Desarrollo local

Requiere Node.js 24 y npm. Desde esta carpeta:

```powershell
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_octubre_rosa.sql
npm run dev
```

Aplicar también `drizzle/0001_single_attempt.sql`, con el mismo comando de migración, antes de iniciar el servidor. Aplicar cada migración solo una vez. Abrir la URL indicada por el servidor (habitualmente `http://localhost:5173`). La base local `.wrangler/state` es independiente de producción. Para probar el panel, crear un archivo ignorado `.dev.vars` con `STATS_ACCESS_TOKEN=` seguido de una clave hexadecimal de 64 caracteres solo para pruebas. Abrir `/estadisticas#acceso=` seguido de esa clave. No usar la clave de producción para pruebas locales.

En Windows, si falla el shim de npm, se puede ejecutar `node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"` seguido de los mismos argumentos.

## Verificación

```powershell
node --test tests/api.test.mjs
node node_modules/typescript/bin/tsc --noEmit
npm run build
```

Las pruebas ejecutan la API y sus consultas reales sobre SQLite en memoria: puntuaciones 0–3, validación de servidor, inicio sin soluciones, aleatoriedad, bloqueo concurrente de respuestas, reintentos, finalización simultánea e idempotente, dispositivos diferentes, exclusión de incompletas/vencidas, autenticación y límites. No escriben en producción.

## Contenido y publicación

1. Editar `lib/questions.ts` y aumentar `QUESTION_SET_VERSION` si cambian preguntas o soluciones. Este módulo se mantiene en el servidor.
2. Revisar el material con el organizador o un profesional de salud antes de usarlo en un evento. Es concientización, no diagnóstico.
3. Si cambia el esquema, editar `db/schema.ts`, ejecutar `npm run db:generate` y revisar la nueva migración. No modificar migraciones ya aplicadas.
4. Publicar mediante el flujo de Sites, conservando el `project_id`, el acceso por URL y la clave secreta del panel. Sites aplica migraciones en el despliegue.

Archivos principales: `app/experience.tsx` (flujo), `app/scratch-card.tsx` (raspado), `app/globals.css` (diseño), `lib/api.ts` (servidor), `lib/questions.ts` (contenido), `db/schema.ts` (persistencia).
