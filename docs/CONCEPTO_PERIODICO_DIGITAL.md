# Concepto Integral del Periódico Digital

## 1. Visión del producto

`Periodico` está concebido como un medio digital contemporáneo, limpio y confiable, orientado a la lectura profunda y al consumo rápido de titulares desde cualquier dispositivo. Su identidad mezcla minimalismo editorial con glassmorphism suave para transmitir claridad, actualidad y sofisticación sin caer en ruido visual.

La experiencia busca equilibrar cuatro objetivos:

- informar con jerarquía clara;
- facilitar el descubrimiento por temas e intereses;
- convertir lectores recurrentes en suscriptores;
- sostener una línea visual coherente en noticias, opinión, multimedia y archivo.

## 2. Arquitectura del sitio

## Capa pública

- Inicio
- Secciones
- Artículo individual
- Búsqueda avanzada
- Archivo histórico
- Autores
- Podcasts y multimedia
- Suscripciones
- Premium

## Capa de interacción

- Reacciones del lector
- Comentarios moderados o respuestas editoriales
- Compartir en redes
- Guardado y seguimiento de temas
- Recomendaciones personalizadas

## Capa editorial

- Panel para redactores y editores
- Flujo de borrador, revisión, publicado y archivado
- Gestión de categorías, etiquetas y autores
- Programación de publicaciones
- Curaduría de portada y titulares destacados
- Validación de piezas multimedia e infografías

## Capa analítica

- artículos más vistos;
- tiempo de lectura;
- origen del tráfico;
- conversión a suscripción;
- rendimiento por categoría;
- interacción por autor, formato y horario.

## Capa de datos

MongoDB almacena:

- artículos;
- autores;
- categorías;
- etiquetas;
- suscripciones;
- reacciones;
- métricas agregadas;
- colecciones auxiliares para recomendaciones y archivo.

## 3. Estructura general del sitio

## Página principal

La home se diseña como una portada editorial:

- bloque hero con el titular principal;
- columna secundaria con últimas noticias;
- franjas temáticas por política, economía, deportes, cultura, tecnología, entretenimiento y opinión;
- módulo de análisis y piezas premium;
- bloque de podcasts o programas;
- listado de artículos más vistos;
- promoción de newsletter y suscripción.

La lógica de portada combina curaduría manual y reglas automáticas:

- un titular principal fijado por editores;
- secundarios por relevancia, recencia y rendimiento;
- módulos laterales por categoría y popularidad;
- personalización ligera si el lector está autenticado.

## Secciones

Cada sección mantiene el mismo lenguaje visual, pero cambia:

- el acento cromático;
- el titular curado;
- el orden de módulos;
- los filtros rápidos por etiquetas.

Secciones contempladas:

- Política
- Economía
- Deportes
- Cultura
- Tecnología
- Entretenimiento
- Opinión
- Internacional
- Podcast
- Verificación de datos

## Página de artículo

La página individual se organiza en este orden:

1. breadcrumb y contexto de sección;
2. titular principal;
3. subtítulo o bajada;
4. autor, fecha, tiempo de lectura y nivel de acceso;
5. elemento multimedia principal;
6. cuerpo del artículo;
7. cita destacada o dato clave;
8. etiquetas;
9. autor y bio;
10. reacciones, comentarios o compartidos;
11. artículos relacionados.

## Navegación

La barra superior es minimalista:

- marca del medio;
- acceso a secciones;
- buscador;
- botón de suscripción;
- acceso al modo claro/oscuro.

En móvil, la navegación se compacta en menú desplegable con prioridad a búsqueda, portada y categorías principales.

## Pie de página

Debe incluir:

- quiénes somos;
- contacto;
- política editorial;
- términos;
- privacidad;
- publicidad;
- RSS y redes sociales;
- acceso al archivo;
- boletines;
- mapa del sitio.

## 4. Funciones del periódico digital

## Publicación y gestión de noticias

El backend debe soportar:

- creación de borradores;
- edición colaborativa;
- revisión editorial;
- programación de publicación;
- archivado;
- destacación en portada;
- control de acceso premium;
- indexación SEO.

Estados sugeridos para un artículo:

- `draft`
- `review`
- `published`
- `archived`

## Búsqueda avanzada

La búsqueda debe permitir:

- texto libre;
- filtros por categoría;
- filtros por etiqueta;
- rango de fecha;
- autor;
- contenido premium;
- relevancia o cronología.

MongoDB puede resolverse con índices de texto más filtros por metadatos.

## Clasificación por categorías y etiquetas

Cada artículo debe pertenecer a:

- una categoría principal;
- múltiples etiquetas;
- un autor;
- un formato editorial opcional: noticia, análisis, opinión, crónica, entrevista, verificación.

## Multimedia

El modelo contempla:

- imagen destacada;
- galería;
- video embebido;
- audio o podcast;
- infografía;
- recursos descargables.

## Interacción del lector

La primera versión puede incluir:

- reacciones rápidas;
- compartir;
- guardar;
- registro de lectura.

La siguiente capa puede añadir:

- comentarios moderados;
- respuestas del autor;
- denuncias de abuso;
- seguimiento de hilos.

## Suscripciones y contenido premium

Se propone un embudo escalonado:

- lector libre;
- suscriptor a boletines;
- suscriptor premium.

Funciones:

- registro por intereses;
- newsletters por categoría;
- artículos cerrados por membresía;
- panel de beneficios;
- promociones personalizadas.

## Archivo histórico

El archivo debe permitir:

- navegación por año y mes;
- búsqueda temática;
- acceso a coberturas especiales;
- línea de tiempo de hitos;
- recuperación de ediciones emblemáticas.

## Redes sociales

La integración incluye:

- tarjetas sociales optimizadas;
- botones de compartir;
- módulos de tendencia;
- publicación automatizada de titulares.

## Analítica

Indicadores centrales:

- vistas por artículo;
- profundidad de lectura;
- rebote;
- tasa de clic desde portada;
- conversión a suscripción;
- artículos más leídos por periodo.

## 5. Diseño visual: minimalismo + glassmorphism

## Paleta sugerida

- Fondo base claro: `#eef2f7`
- Superficie translúcida: `rgba(255, 255, 255, 0.58)`
- Texto principal: `#172033`
- Texto secundario: `#5a677d`
- Azul editorial: `#2c5cff`
- Verde economía: `#27b07d`
- Coral cultura/entretenimiento: `#ff6f61`
- Ámbar opinión: `#f0a43a`
- Bordes vidrio: `rgba(255, 255, 255, 0.48)`

Modo oscuro adaptado:

- Fondo: `#09111f`
- Superficie translúcida: `rgba(12, 20, 36, 0.58)`
- Texto principal: `#f5f7fb`
- Texto secundario: `#b6c1d6`
- Bordes: `rgba(255, 255, 255, 0.12)`

## Principios visuales

- mucho aire entre bloques;
- pocas líneas decorativas;
- titulares de alto contraste;
- tarjetas con blur suave;
- sombras amplias y ligeras;
- color usado como guía semántica, no como saturación dominante.

## Sistema tipográfico

- titulares: serif editorial o sans de alto contraste;
- cuerpo: sans legible, ancha y limpia;
- metadatos: tamaños pequeños, espaciado generoso y mayúsculas controladas.

Jerarquía:

- `H1`: gran titular de portada o artículo.
- `H2`: cabeceras de sección.
- `H3`: titulares secundarios.
- cuerpo: 18 a 20 px ideal en escritorio.
- captions y meta: 12 a 14 px.

## Componentes visuales

## Tarjetas de noticia

Cada tarjeta usa:

- fondo translúcido;
- borde suave;
- blur;
- radio de 24 a 32 px;
- micro sombra difusa;
- etiqueta de categoría;
- meta en una sola línea;
- llamada visual clara al titular.

## Navegación

La barra superior flota sobre el fondo con:

- transparencia moderada;
- blur fuerte;
- borde fino;
- botones tipo cápsula.

## Fondos

El fondo general debe tener:

- gradientes fríos muy sutiles;
- halos desenfocados;
- capas de profundidad suaves;
- nada de texturas agresivas.

## Animaciones

- aparición progresiva en carga;
- hover con elevación mínima;
- transición de color y blur entre temas;
- micro desplazamiento en tarjetas destacadas.

## Iconografía

- trazos finos;
- formas geométricas;
- consistencia monocromática;
- énfasis por color solo en estado activo.

## 6. Experiencia del usuario

## Responsive

### Móvil

- navegación compacta;
- hero apilado;
- tarjetas a una columna;
- sticky search y acceso rápido a secciones.

### Tablet

- portada en dos columnas;
- bloques laterales simplificados;
- mejor protagonismo de multimedia.

### Escritorio

- jerarquía editorial amplia;
- malla de 12 columnas;
- mezcla de contenido destacado, listas y paneles laterales.

## Lectura cómoda

La lectura debe priorizar:

- anchura de línea controlada;
- interlineado generoso;
- alto contraste;
- separación clara entre párrafos, citas y multimedia.

## Accesibilidad

- estructura semántica correcta;
- navegación por teclado;
- foco visible;
- atributos `alt`;
- contraste AA o superior;
- etiquetas claras en formularios;
- soporte de lector de pantalla.

## Modo claro y modo oscuro

Ambos modos conservan el lenguaje glassmorphism, pero ajustan:

- densidad del blur;
- color de bordes;
- profundidad de sombras;
- brillo de textos y acentos.

## 7. Elementos adicionales opcionales

## Podcasts

Sección dedicada con:

- episodio destacado;
- reproductor compacto;
- series temáticas;
- acceso desde portada y artículos relacionados.

## Perfiles de autor

Cada perfil debe mostrar:

- foto;
- biografía;
- especialidad;
- últimas publicaciones;
- métricas de lectura;
- redes o contacto profesional.

## Verificación de datos

Módulo editorial con:

- nivel de veracidad;
- fuentes utilizadas;
- metodología;
- fecha de revisión;
- sello visual de confianza.

## Recomendaciones personalizadas

Motor basado en:

- historial de lectura;
- categorías frecuentes;
- etiquetas guardadas;
- tiempo de permanencia;
- nivel de suscripción.

## 8. Interacción del usuario

## Flujo principal del lector

1. entra a portada;
2. escanea el hero y titulares recientes;
3. navega por una sección o usa búsqueda;
4. abre un artículo;
5. reacciona, comparte o continúa con piezas relacionadas;
6. se suscribe a boletín o premium.

## Flujo del lector recurrente

1. vuelve al sitio;
2. recibe portada parcialmente personalizada;
3. consulta guardados o temas de interés;
4. consume más multimedia o premium;
5. profundiza por autor o archivo.

## Flujo editorial

1. redactor crea borrador;
2. editor revisa y corrige;
3. se asignan categoría, etiquetas, SEO y multimedia;
4. se publica o programa;
5. analítica devuelve rendimiento para reubicación en portada.

## 9. Lógica funcional del sistema

## Backend

La API se organiza por dominios:

- artículos;
- categorías;
- autores;
- suscripciones;
- reacciones;
- analítica.

## Modelo de contenidos

Colecciones sugeridas:

- `articles`
- `authors`
- `categories`
- `subscriptions`
- `reactions`

Campos clave del artículo:

- título;
- slug;
- subtítulo;
- extracto;
- cuerpo;
- autor;
- categoría;
- etiquetas;
- multimedia principal;
- estado;
- fecha de publicación;
- premium;
- métricas.

## Lógica de portada

La home combina:

- selección editorial fija;
- contenido reciente;
- popularidad reciente;
- equilibrio temático;
- recomendaciones para usuarios identificados.

## Lógica de búsqueda

La búsqueda evalúa:

- coincidencia textual;
- actualidad;
- relevancia por clics;
- afinidad del lector;
- filtros activos.

## Lógica de archivo

El archivo se organiza por:

- calendario;
- grandes coberturas;
- taxonomías;
- autores;
- palabras clave.

## 10. Coherencia estética global

Toda la plataforma debe sentirse como un solo sistema. Eso se logra manteniendo:

- la misma gramática de paneles de vidrio;
- una jerarquía tipográfica estable;
- colores de acento por sección;
- espaciados generosos en todas las vistas;
- consistencia entre portada, sección, artículo, autor, búsqueda y suscripciones.

La estética no debe competir con la noticia. El glassmorphism aquí sirve para ordenar, suavizar y dar profundidad, no para distraer. El resultado ideal es un medio digital elegante, serio, actual y muy legible.

## 11. Traducción técnica al proyecto actual

En esta base se dejó prevista la siguiente implementación:

- `frontend`: aplicación Angular con portada, secciones y artículo demo.
- `backend`: API Express con estructura para MongoDB mediante Mongoose.
- `docs`: documento rector para producto, diseño y evolución.

Esta combinación permite pasar del concepto a un MVP funcional sin rehacer la arquitectura.

