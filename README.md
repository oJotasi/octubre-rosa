# Octubre Rosa

Web sencilla con HTML, CSS y JavaScript, sin dependencias ni compilación.

Juego: https://ojotasi.github.io/octubre-rosa/

| Archivo | Contenido |
| --- | --- |
| `index.html` | Página del juego. |
| `estadisticas.html` | Página del panel de estadísticas. |
| `styles.css` | Estilos de ambas páginas. |
| `juego.js` | Preguntas, raspado, navegación y envío de respuestas. |
| `estadisticas.js` | Consulta y actualización del panel. |
| `comun.js` | Dirección pública del servidor, iconos y utilidades. |
| `ribbon.svg`, `favicon.svg` | Cinta e icono. |
| `acceso-qr.svg` | QR que abre el juego. |

GitHub Pages sirve estos archivos directamente desde la rama `main`, carpeta raíz. Al guardar cambios en esa rama, GitHub vuelve a publicar la web. No se usa npm, React ni un proceso de compilación.

El servidor, las preguntas oficiales y la base de datos permanecen en Sites. El navegador consulta esa API; este repositorio contiene solo la interfaz. Cambiar el diseño no requiere modificar Sites.

El panel usa `estadisticas.html#acceso=<clave>`. La clave se comparte por separado, no se guarda en estos archivos. Recargar el juego permite una sesión nueva; cada carga tiene un intento.

Para probar una copia local, servir esta carpeta con un servidor HTTP estático. La API acepta el origen público de GitHub Pages; para probar las llamadas desde otro origen hay que habilitarlo expresamente en Sites.
