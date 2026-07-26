# Plan De Correo A Produccion

## Diagnostico actual

Hoy los correos de suscripcion tienen alta probabilidad de caer en spam por estas razones:

1. El remitente actual es una cuenta personal de Gmail y no un dominio propio del medio.
2. Las URLs publicas del sistema todavia apuntan a `localhost`, lo que degrada la confianza del mensaje y rompe los enlaces para lectores reales.
3. No hay evidencia de configuracion de entregabilidad del dominio del medio: `SPF`, `DKIM` y `DMARC`.
4. Las credenciales SMTP y otros secretos ya expuestos deben rotarse antes de cualquier salida real.

## Objetivo

Lograr que los correos de:

- confirmacion de suscripcion
- bienvenida
- cancelacion o gestion de suscripcion

salgan desde el dominio del medio, con buena reputacion, enlaces reales y la minima probabilidad posible de spam.

## Ruta recomendada

### Opcion recomendada

Usar un proveedor transaccional real. Desde el 26 de julio de 2026 el proyecto ya puede trabajar tanto con `Resend API` como con `SMTP`.

Opciones recomendadas:

- Resend
- Postmark
- Mailgun
- SendGrid

La salida mas limpia para este proyecto hoy es `Resend`, porque evita pelear con SMTP y deja una integracion mas directa.

## Pasos obligatorios

### 1. Definir el dominio real

Ejemplo:

- sitio publico: `https://colombianopromedio.com`
- correo editorial: `redaccion@colombianopromedio.com`
- remitente tecnico: `no-reply@colombianopromedio.com`

### 2. Crear remitentes del medio

Minimo:

- `no-reply@tudominio.com`
- `redaccion@tudominio.com`

No usar Gmail personal como remitente de produccion.

### 3. Configurar DNS del dominio

Debes publicar en tu DNS:

- `SPF`
- `DKIM`
- `DMARC`

Minimo esperado:

- `SPF`: autoriza al proveedor SMTP a enviar por tu dominio
- `DKIM`: firma criptograficamente los mensajes
- `DMARC`: define politica y reportes

Politica sugerida para arrancar:

- `DMARC p=none` para observar
- luego subir a `quarantine`
- finalmente `reject` cuando todo este estable

### 4. Cambiar la configuracion del backend

En produccion, el `.env` debe dejar de usar `localhost` y Gmail personal.

Valores esperados si usas Resend:

```env
NODE_ENV=production
PUBLIC_SITE_URL=https://tudominio.com
PUBLIC_SERVER_URL=https://api.tudominio.com
FRONTEND_ORIGINS=https://tudominio.com
ALLOWED_HOSTS=tudominio.com,api.tudominio.com

RESEND_API_KEY=TU_API_KEY_REAL
RESEND_FROM_EMAIL=no-reply@tudominio.com
RESEND_REPLY_TO=redaccion@tudominio.com
```

Valores esperados si usas SMTP:

```env
NODE_ENV=production
PUBLIC_SITE_URL=https://tudominio.com
PUBLIC_SERVER_URL=https://api.tudominio.com
FRONTEND_ORIGINS=https://tudominio.com
ALLOWED_HOSTS=tudominio.com,api.tudominio.com

SMTP_HOST=smtp.tu-proveedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=no-reply@tudominio.com
SMTP_PASS=TU_CLAVE_SMTP_REAL
SMTP_FROM_NAME=Colombiano Promedio
SMTP_FROM_EMAIL=no-reply@tudominio.com
SMTP_REPLY_TO=redaccion@tudominio.com
```

### 5. Rotar secretos antes de publicar

Debes regenerar:

- `JWT_SECRET`
- `RESEND_API_KEY` o `SMTP_PASS`
- `ADMIN_PASSWORD`
- `JOURNALIST_PASSWORD`

Y no reutilizar ninguno que haya sido compartido en chats o capturas.

### 6. Verificar enlaces publicos del correo

El sistema construye enlaces de confirmacion y salida a partir de `PUBLIC_SITE_URL`.

Eso significa que antes de publicar debes comprobar que los correos apunten a:

- `https://tudominio.com/boletin/confirmar?...`
- `https://tudominio.com/boletin/salir?...`

No deben existir enlaces a `localhost`.

## Ajustes recomendados de reputacion

### Prioridad alta

- usar dominio propio
- usar proveedor transaccional
- activar `SPF`, `DKIM`, `DMARC`
- mantener `FROM` y `REPLY-TO` alineados con el mismo dominio

### Prioridad media

- evitar asuntos demasiado agresivos o promocionales
- no mandar lotes grandes al inicio
- calentar reputacion con volumen pequeno
- revisar rebotes y quejas

### Prioridad baja pero valiosa

- crear direccion `abuse@tudominio.com`
- crear direccion `postmaster@tudominio.com`
- monitorear reportes DMARC

## Lo que ya esta bien en el codigo

El flujo actual ya trae varias cosas utiles:

- version HTML y texto plano del correo
- `List-Unsubscribe`
- `List-Unsubscribe-Post`
- `Feedback-ID`
- enlaces separados para confirmar y salir

Eso ayuda, pero no compensa una configuracion pobre de dominio o remitente.

## Checklist final antes de publicar

- dominio real configurado
- HTTPS activo
- proveedor SMTP de produccion configurado
- `SPF` valido
- `DKIM` valido
- `DMARC` publicado
- `PUBLIC_SITE_URL` sin `localhost`
- `PUBLIC_SERVER_URL` sin `localhost`
- remitente `FROM` del dominio del medio
- secretos rotados
- correo de prueba recibido fuera de spam en Gmail
- correo de prueba recibido fuera de spam en Outlook
- enlaces de confirmar y salir funcionando

## Recomendacion QA final

La salida mas limpia para este proyecto es:

1. montar el dominio real
2. configurar Resend con dominio propio y DNS correcto
3. corregir el `.env` productivo
4. rotar secretos
5. hacer pruebas reales en Gmail y Outlook antes del lanzamiento

## Archivo relacionado

Como base de variables de entorno para produccion ya existe:

- `backend/.env.production.example`
