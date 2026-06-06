# Commission Upload Portal

Sitio estático listo para GitHub Pages con backend en Google Apps Script.

## Qué hace

- Muestra un formulario limpio para comisiones.
- Permite subir varios archivos a la vez.
- Envía cada archivo a tu Web App de Apps Script.
- Crea una carpeta por cliente dentro de tu carpeta principal de Drive.
- Guarda un `README.md` con la descripción del proyecto.
- Puede mandar un aviso a Discord por webhook.

## Archivos del proyecto

- `index.html`
- `styles.css`
- `script.js`
- `Code.gs`
- `appsscript.json`

## Configuración

### 1) Crear el proyecto de Apps Script

1. Abre [script.google.com](https://script.google.com/).
2. Crea un proyecto nuevo.
3. Pega el contenido de `Code.gs`.
4. Guarda.

### 2) Configurar la carpeta de Drive

1. Abre la carpeta de Google Drive donde quieres guardar las comisiones.
2. Copia el ID desde la URL.
3. Pégalo en `Code.gs` en `CONFIG.folderId`.

### 3) Configurar Discord

1. Crea un webhook en el canal donde quieres recibir avisos.
2. Pega la URL en `Code.gs` en `CONFIG.discordWebhookUrl`.
3. Si no quieres avisos, deja el valor como placeholder.

### 4) Desplegar como Web App

1. En Apps Script ve a `Deploy > New deployment`.
2. Elige `Web app`.
3. En `Execute as`, selecciona `Me`.
4. En `Who has access`, selecciona `Anyone`.
5. Haz clic en `Deploy`.
6. Copia la URL que termina en `/exec`.

### 5) Conectar el frontend

1. Abre `script.js`.
2. Reemplaza la URL de `CONFIG.scriptUrl` por la URL `/exec` del despliegue.
3. Sube `index.html`, `styles.css` y `script.js` a tu repositorio de GitHub.

### 6) Publicar en GitHub Pages

1. En GitHub entra a `Settings > Pages`.
2. Elige `Deploy from a branch`.
3. Selecciona la rama y la carpeta raíz.
4. Guarda los cambios.

## Nota importante

Cuando cambies `Code.gs`, vuelve a `Deploy > Manage deployments` y publica una **nueva versión**.  
Apps Script sirve la versión publicada, no solo el archivo guardado.
