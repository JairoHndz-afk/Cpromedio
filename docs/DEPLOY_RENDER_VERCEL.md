# Despliegue de producción

## Arquitectura

- `backend/` se despliega como servicio web Node.js en Render.
- `frontend/` se despliega en Vercel.
- Vercel expone la SPA y reenvía `/api/*`, `/robots.txt` y `/sitemap.xml` hacia Render.
- MongoDB debe vivir en Atlas o en una instancia externa accesible desde Render.

## Backend en Render

### Opción rápida

Usa el archivo `render.yaml` desde la raíz del repositorio.

### Variables obligatorias

- `MONGODB_URI`
- `JWT_SECRET`
- `PUBLIC_SERVER_URL`
- `PUBLIC_SITE_URL`
- `FRONTEND_ORIGINS`
- `ALLOWED_HOSTS`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `JOURNALIST_EMAIL`
- `JOURNALIST_PASSWORD`

### Variables de imagenes con Cloudinary

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_UPLOAD_FOLDER`

### Variables de correo con Resend

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_REPLY_TO`

### Variables de correo alternas por SMTP

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME`
- `SMTP_REPLY_TO`

### Valores recomendados

- `NODE_ENV=production`
- `TRUST_PROXY=true`
- `BOOTSTRAP_ON_START=false`
- `NEWSLETTER_REQUIRE_CONFIRM=true`
- `COOKIE_NAME=colombiano_promedio_session`

### Almacenamiento de imagenes

Si configuras Cloudinary, no necesitas disco persistente en Render para portadas e imagenes del cuerpo.

Eso permite desplegar el backend incluso en un plan sin disco, siempre que las subidas queden yendo a Cloudinary.

## Frontend en Vercel

### Root Directory

- `frontend`

### Build settings

- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist/periodico-frontend`

### Variable obligatoria

- `BACKEND_PUBLIC_URL=https://TU-BACKEND-EN-RENDER.onrender.com`

## Dominios y seguridad

Si tu frontend queda en `https://colombianopromedio.vercel.app` y tu backend en `https://colombiano-promedio-backend.onrender.com`, entonces en Render debes dejar:

- `PUBLIC_SITE_URL=https://colombianopromedio.vercel.app`
- `PUBLIC_SERVER_URL=https://colombiano-promedio-backend.onrender.com`
- `FRONTEND_ORIGINS=https://colombianopromedio.vercel.app`
- `ALLOWED_HOSTS=colombianopromedio.vercel.app,colombiano-promedio-backend.onrender.com`

## SEO técnico ya preparado

Quedó listo lo siguiente:

- `robots.txt` servido desde `/robots.txt`
- `sitemap.xml` servido desde `/sitemap.xml`
- `canonical`, Open Graph y Twitter Cards dinámicos
- JSON-LD para artículos y perfiles de autor
- `site.webmanifest`
- `noindex` en `login`, `dashboard` y páginas transaccionales del boletín

## Checklist antes de publicar

- Confirma que `PUBLIC_SITE_URL` y `BACKEND_PUBLIC_URL` ya usan dominios finales.
- Confirma que `CLOUDINARY_*` ya tiene valores reales antes de probar subidas desde dashboard.
- Verifica que el SMTP use un dominio propio con SPF, DKIM y DMARC.
- Si usas Resend, verifica el dominio remitente y no dejes `onboarding@resend.dev` en produccion.
- Sube una imagen desde dashboard y comprueba que la URL resultante apunte a `res.cloudinary.com`.
- Abre `https://TU-FRONTEND/robots.txt`.
- Abre `https://TU-FRONTEND/sitemap.xml`.
- Publica un artículo y revisa el HTML renderizado, metatags y enlaces del autor.
