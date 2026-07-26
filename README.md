# Periodico

Sitio editorial digital con:

- `frontend`: Angular 19 con interfaz minimalista y glassmorfismo sutil.
- `backend`: Node.js + Express + MongoDB con autenticacion por roles, moderacion y auditoria.
- `docs`: soporte conceptual original del proyecto.

## URLs locales

- Frontend publico: `http://localhost:4200`
- Login editorial: `http://localhost:4200/login`
- Dashboard editorial: `http://localhost:4200/dashboard`
- API: `http://localhost:4000/api`

## Credenciales iniciales de entorno local

- Admin: `admin@periodico.local` / `Admin#2026`
- Periodista: `periodista@periodico.local` / `Periodista#2026`

Estas credenciales solo deben existir en desarrollo local. Fuera de local, el backend ahora exige `JWT_SECRET`, `PUBLIC_SERVER_URL`, `FRONTEND_ORIGINS`, hosts permitidos y claves seguras.

## Arranque

Comandos directos recomendados en esta maquina:

```powershell
cd C:\Users\Jairo\Downloads\Periodico
.\backend-dev.ps1
```

```powershell
cd C:\Users\Jairo\Downloads\Periodico
.\frontend-dev.ps1
```

Alternativa dentro de cada carpeta:

Backend:

```powershell
cd C:\Users\Jairo\Downloads\Periodico\backend
npm run dev
```

Frontend:

```powershell
cd C:\Users\Jairo\Downloads\Periodico\frontend
npm run dev
```

## Produccion local

Plantilla recomendada de variables para salida real:

```powershell
C:\Users\Jairo\Downloads\Periodico\backend\.env.production.example
```

Usa esa plantilla como base para tu `.env` productivo y reemplaza todos los secretos, dominio y credenciales antes de publicar.

Backend:

```powershell
cd C:\Users\Jairo\Downloads\Periodico
.\backend-prod.ps1
```

Frontend compilado:

```powershell
cd C:\Users\Jairo\Downloads\Periodico
.\frontend-prod.ps1
```

Alternativa dentro de cada carpeta:

Backend:

```powershell
cd C:\Users\Jairo\Downloads\Periodico\backend
npm start
```

Bootstrap manual de usuarios base:

```powershell
cd C:\Users\Jairo\Downloads\Periodico\backend
node src\scripts\bootstrap-users.js
```

Frontend compilado:

```powershell
cd C:\Users\Jairo\Downloads\Periodico\frontend
npm run start
```

## Seguridad aplicada

- Sesion con cookie `httpOnly`, `sameSite=strict` y `secure` en produccion.
- CORS restringido por origen permitido.
- Validacion de `Host` permitido y bloqueo de orígenes no confiables antes de responder la API.
- Proteccion de mutaciones con verificacion de origen y `X-Requested-With`.
- Defensa adicional con `Sec-Fetch-Site`, `helmet`, rate limiting, validacion con `zod` y sanitizacion de entradas.
- Uploads con firma de archivo validada, escritura exclusiva y URLs publicas construidas desde configuracion segura.
- Roles `admin` y `journalist`.
- Moderacion editorial completa y `audit log`.

## Notas

- El sitio publico no depende de categorias fijas.
- Las categorias son opcionales y se administran solo desde el dashboard.
- El backend usa `backend/.env` y MongoDB local en `mongodb://127.0.0.1:27017/periodico`.
