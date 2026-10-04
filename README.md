# Whitebird WoW Class Wheel

Bot de Discord para repartir las 12 clases de WoW entre miembros de Whitebird. Publica una ruleta visual, asigna una clase única por jugador y conserva todo aunque el bot se reinicie.

## Cómo funciona

- Un oficial publica el panel con `/ruleta-alter`.
- Cada miembro pulsa **Girar la ruleta** una vez por ronda. El bot muestra el resultado de forma privada y actualiza la imagen y las clases disponibles en el panel.
- El resultado también incluye un rol elegido al azar entre los que puede desempeñar esa clase: Tanque, DPS o Sanador. La clase se sortea primero y el rol se guarda junto con ella.
- Ninguna clase se repite durante una ronda. Al repartir las 12, el botón se desactiva.
- `/mi-alter` consulta tu resultado y `/alter-list` muestra la lista completa (visible solo para quien ejecuta el comando).
- `/alter-spec usuario spec` permite a un oficial cambiar el rol de un alter asignado, validando que su clase pueda desempeñarlo.
- Cada miembro puede vincular un personaje de WoW con `/registrar-alter nombre reino region`. El personaje debe ser de la clase asignada por la ruleta; cada miembro registra uno.
- `/ranking-alters` muestra los personajes registrados ordenados por su piedra M+ más alta de la temporada actual, con ilvl equipado como desempate. `actualizar: true` solicita datos nuevos a Raider.IO.
- `/alter-reset usuario` libera una asignación individual; `/alter-reset-all confirmar:true` empieza una ronda nueva.
- Los resultados se guardan en SQLite, separados por servidor. Los reinicios del proceso no los borran.

Clases incluidas: Druid, Hunter, Mage, Monk, Paladin, Priest, Rogue, Shaman, Warlock, Warrior, DK y DH. La imagen de la ruleta dibuja las letras como formas vectoriales para evitar problemas de fuentes en Docker.

## 1. Crear la aplicación y el bot

1. Abre el [Discord Developer Portal](https://discord.com/developers/applications) e inicia sesión con una cuenta que pueda administrar Whitebird.
2. Pulsa **New Application**, ponle un nombre (por ejemplo, `Whitebird WoW Wheel`) y crea la aplicación.
3. En **Bot**, crea el bot si todavía no existe y copia su **Token**. Guárdalo como secreto: no lo publiques ni lo subas a Git.
4. En **General Information**, copia el **Application ID**.
5. En **OAuth2 → URL Generator**, marca los scopes `bot` y `applications.commands`. En permisos del bot marca `View Channels`, `Send Messages`, `Embed Links` y `Attach Files`. Abre la URL generada y añade el bot a Whitebird.

https://discord.com/oauth2/authorize?client_id=1555739616345063424&permissions=309237681152&integration_type=0&scope=bot+applications.commands

El bot solo necesita el intent de servidor básico; no hace falta habilitar intents privilegiados ni permisos de administrador.

## 2. Preparar los valores

Copia `.env.example` como `.env` y completa:

```dotenv
DISCORD_TOKEN=token_del_bot
DISCORD_CLIENT_ID=id_de_la_aplicacion
DISCORD_GUILD_ID=id_del_servidor_whitebird
OFFICER_ROLE_IDS=id_rol_oficial,id_otro_rol
```

`DISCORD_GUILD_ID` es opcional pero recomendable inicialmente: registra los comandos al instante en Whitebird. Si se omite, se publican globalmente y Discord puede tardar un rato en mostrarlos. Para copiar IDs activa **Ajustes de usuario → Avanzado → Modo desarrollador** y usa **Copiar ID** en servidor y roles.

Los comandos `/alter-reset`, `/alter-reset-all`, `/alter-spec` y `/ranking-alters` solo están disponibles para miembros con **Gestionar servidor** o alguno de los roles indicados en `OFFICER_ROLE_IDS`. Déjalo vacío para basarte únicamente en el permiso de Discord. Reinicia el proceso después de cambiar `.env`.

## 3. Ejecutar con Docker (recomendado)

Necesitas Docker Desktop o Docker Engine con Compose.

```sh
cp .env.example .env
# Edita .env con el token, Application ID e ID de Whitebird
docker compose build
docker compose run --rm whitebird-wow-wheel npm run register
docker compose up -d --build
docker compose logs -f
```

La base persistente está en `data/whitebird.sqlite`, montada fuera del contenedor. Para actualizar el bot, descarga la versión nueva del proyecto y ejecuta `docker compose build`, `docker compose run --rm whitebird-wow-wheel npm run register` y `docker compose up -d`. Registrar de nuevo actualiza la lista de comandos de Discord. Haz una copia de `data/` antes de actualizar o mover el servicio.

## Alternativa: ejecutar con Node.js

Requiere Node.js 20.11 o posterior y herramientas nativas de compilación para `better-sqlite3` si no hay un binario disponible para tu sistema.

```sh
cp .env.example .env
# Edita .env
npm install
npm run register
npm start
```

Deja el proceso en un equipo/servidor que esté encendido. Para que se recupere de reinicios del sistema, usa un gestor de procesos o el despliegue Docker de arriba. La carpeta `data/` contiene las asignaciones.

## Primer uso en Whitebird

1. Espera a que el bot aparezca conectado.
2. Ejecuta `/ruleta-alter` en el canal donde quieras dejar el panel (o elige el canal en la opción `canal`).
3. Los miembros usan el botón del mensaje.
4. Comprueba resultados con `/alter-list`; cada miembro también puede usar `/mi-alter`.
5. Un oficial puede ajustar el rol con `/alter-spec usuario spec`.
6. Cada miembro vincula su personaje asignado con `/registrar-alter nombre reino region` (regiones admitidas: EU, US, KR y TW).
7. Consulta la clasificación con `/ranking-alters`; usa `actualizar: true` para solicitar una consulta nueva a Raider.IO.
8. Para iniciar temporada nueva, un oficial ejecuta `/alter-reset-all` y elige `confirmar: true`.

No borres el mensaje del panel: los botones de otros mensajes de ruleta seguirían asignando, pero `/ruleta-alter` registra el panel que el bot actualizará. Si borras el panel, publica otro con `/ruleta-alter`.

## Estructura

- `src/index.js`: bot, comandos y botón de giro.
- `src/database.js`: almacenamiento SQLite.
- `src/wheel-image.js`: imagen de ruleta generada para Discord.
- `src/register-commands.js`: registro de comandos de aplicación.
- `Dockerfile` y `compose.yaml`: despliegue persistente.

El bot no asigna roles de Discord automáticamente; la clase queda guardada y visible en la lista del bot. El ranking consulta la API pública de [Raider.IO](https://raider.io/api), no necesita token, enlaza cada perfil como atribución y puede reflejar los cambios con retraso. Se conservan en SQLite el personaje vinculado y los últimos datos consultados para que el ranking siga disponible si Raider.IO no responde temporalmente.

Al actualizar desde la primera versión, se conservan las clases ya asignadas y el bot les añade un rol compatible durante el arranque.
