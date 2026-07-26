# Concepto Integral De Colombiano Promedio

## 1. Visión del producto

`Colombiano Promedio` está concebido como un medio digital contemporáneo, limpio y confiable, orientado a la lectura profunda y al consumo rápido de titulares desde cualquier dispositivo. Su identidad mezcla minimalismo editorial con glassmorphism suave para transmitir claridad, actualidad y sofisticación sin caer en ruido visual.

La experiencia busca equilibrar cuatro objetivos:

- informar con jerarquía clara;
- facilitar el descubrimiento por temas e intereses;
- convertir lectores recurrentes en suscriptores;
- sostener una línea visual coherente en noticias, opinión, multimedia y archivo.

## 2. Arquitectura del sitio

### Capa pública

- Inicio
- Artículo individual
- Búsqueda avanzada
- Archivo histórico
- Autores
- Suscripciones

### Capa de interacción

- Compartir en redes
- Guardado y seguimiento de temas
- Recomendaciones personalizadas

### Capa editorial

- Panel para redactores y editores
- Flujo de borrador, revisión, publicado, archivado y papelera editorial
- Gestión de etiquetas, autores y portada
- Validación de piezas multimedia

### Capa analítica

- artículos más vistos;
- tiempo de lectura;
- origen del tráfico;
- conversión a suscripción;
- rendimiento por autor y publicación.

### Capa de datos

MongoDB almacena:

- artículos;
- autores;
- etiquetas;
- suscripciones;
- métricas agregadas;
- colecciones auxiliares de auditoría y vistas.

## 3. Estructura general del sitio

### Página principal

La home funciona como portada editorial:

- bloque hero con la publicación destacada;
- franja de citas editoriales;
- buscador;
- tarjetas de últimas publicaciones;
- suscripción al boletín.

La portada combina curaduría manual y reglas automáticas:

- un titular principal fijado por administración;
- secundarios por recencia;
- personalización ligera mediante etiquetas o autor.

### Página de artículo

La vista individual se organiza así:

1. acciones rápidas;
2. titular;
3. subtítulo;
4. metadatos de lectura;
5. imagen de portada;
6. cuerpo con bloques enriquecidos;
7. recomendación relacionada;
8. navegación a siguiente lectura.

### Navegación

La barra superior es minimalista:

- marca del medio;
- acceso a inicio y panel;
- cambio de tema;
- menú móvil responsivo.

### Pie de página

El pie mantiene una presencia editorial breve, con frases institucionales y el cierre visual del medio.

## 4. Diseño visual

La dirección visual se apoya en:

- paleta inspirada en la bandera de Colombia;
- fondos sobrios con profundidad suave;
- tarjetas de vidrio con blur controlado;
- contraste tipográfico alto;
- botones cápsula con estados claros.

## 5. Experiencia del usuario

La experiencia prioriza:

- lectura cómoda;
- jerarquía tipográfica clara;
- buena respuesta en móvil, tablet y escritorio;
- accesibilidad semántica y por teclado;
- coherencia entre modo claro y modo oscuro.

## 6. Lógica funcional

El sistema actual contempla:

- publicación y moderación editorial;
- control de usuarios por rol;
- boletín con confirmación, baja y reactivación;
- control de destacados únicos;
- perfiles de autor y navegación por autor;
- SEO técnico y metadatos sociales.

## 7. Coherencia general

Toda la plataforma debe sentirse como un solo sistema: sobrio, legible, contemporáneo y con suficiente identidad visual para diferenciarse sin sacrificar claridad periodística.
