# Colombiano Promedio

Sitio editorial digital con identidad visual propia, moderación completa, boletín de suscripción y despliegue preparado para producción.

## Stack

- `frontend`: Angular 19
- `backend`: Node.js + Express
- `database`: MongoDB
- `mail`: Resend o SMTP

## URLs locales

- Público: `http://localhost:4200`
- Acceso editorial: `http://localhost:4200/login`
- Panel: `http://localhost:4200/dashboard`
- API: `http://localhost:4000/api`

## Desarrollo

Desde la raíz:

```powershell
.\backend-dev.ps1
.\frontend-dev.ps1
```

Alternativa manual:

```powershell
cd backend
npm run dev
```

```powershell
cd frontend
npm run dev
```

## Producción

La base de entorno productivo está en:

```text
backend/.env.production.example
```

Úsala para configurar:

- `MONGODB_URI`
- `JWT_SECRET`
- `PUBLIC_SITE_URL`
- `PUBLIC_SERVER_URL`
- `FRONTEND_ORIGINS`
- `ALLOWED_HOSTS`
- `RESEND_API_KEY` y `RESEND_FROM_EMAIL` si usarás Resend
- o variables `SMTP_*` si usarás SMTP

Arranque local de producción:

```powershell
.\backend-prod.ps1
.\frontend-prod.ps1
```

Alternativa manual:

```powershell
cd backend
npm start
```

```powershell
cd frontend
npm run start
```

## Despliegue recomendado

- `backend`: Render
- `frontend`: Vercel

Guías disponibles:

- `docs/DEPLOY_RENDER_VERCEL.md`
- `docs/PLAN_CORREO_PRODUCCION.md`

## Seguridad aplicada

- Cookie de sesión `httpOnly`, `sameSite=strict` y `secure` en producción.
- CORS restringido por origen permitido.
- Validación de `Host` y rechazo de orígenes no confiables.
- Protección de mutaciones con `Origin`, `Referer` y `X-Requested-With`.
- `helmet`, rate limiting y validación con `zod`.
- Sanitización de medios y bloqueo de URLs externas arbitrarias.
- Subidas con validación de firma real de archivo.
- Roles `admin` y `journalist` con auditoría editorial.

## SEO y privacidad

El proyecto ya incluye:

- `robots.txt`
- `sitemap.xml`
- metadatos Open Graph y Twitter
- JSON-LD para artículos y autores
- banner de cookies y preferencias de medición

## Nota importante

No subas secretos reales al repositorio. Usa variables de entorno para claves, correos, tokens y credenciales de producción.
