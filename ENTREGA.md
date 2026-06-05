# Entrega técnica — AI Citation Visibility Dashboard

- **Repositorio de GitHub**: [COMPLETAR: URL del repo]
- **Demo en vivo**: [COMPLETAR: URL o "no deployada"]
- **Stack**: Next.js + TypeScript, persistencia local en SQLite

---

## ⚡ Cómo probar la demo en 30 segundos

Para probar el flujo principal del sistema de inmediato sin necesidad de configurar claves API de terceros:

1. **Abrir la aplicación**: Ve al entorno local (usualmente [http://localhost:3000](http://localhost:3000)).
2. **Cargar empresa**: En el primer paso, completa el formulario con la marca **Atlas Copco** y el dominio `atlascopco.com` (ya cuenta con un autocompletado de prueba). Presiona "Siguiente".
3. **Ejecutar auditoría**: En el paso de generación y ejecución, haz clic en **"Iniciar Auditoría"** (por defecto corre en **modo Mock/Simulado**, sin consumir claves de API).
4. **Ver el dashboard**: Deja que se completen las preguntas simuladas y observa los gráficos interactivos del dashboard (Share of Voice, Top Dominios Citados, análisis de competidores y brechas de contenido).

---

Este documento mapea la implementación real del proyecto contra los requisitos del reto de entrevista *"AI Citation Visibility Dashboard"*. Está dividido en tres bloques: lo que se pidió, lo que el sistema ya tiene, y lo que se agregó por encima del mínimo.

---

## Sección 1 — Lo que se pidió (requisitos del reto)

El reto pide un sistema web para auditar la visibilidad de una marca en respuestas de buscadores con IA (AEO/GEO): cuando un comprador pregunta por una categoría, ¿a quién cita la IA — a la empresa, a sus competidores, a sitios de reseñas, a publicaciones, o a alguien fuera del radar?

### Módulos obligatorios

1. **Cargar empresa** — nombre, dominio y descripción de lo que vende.
2. **Generar preguntas** — un set de 5 a 8 preguntas de intención de compra.
3. **Ejecutar auditoría** — correr esas preguntas contra al menos un proveedor de IA/búsqueda (real o simulado).
4. **Extraer citas** — obtener las URLs/dominios citados en las respuestas.
5. **Panel** — un dashboard que consolide los resultados.

### Vistas obligatorias del panel

- **V1 — Dominios más citados:** qué fuentes aparecen con mayor frecuencia.
- **V2 — Presencia de la empresa objetivo:** en qué proporción de respuestas es citada la marca propia (*Share of Voice*).
- **V3 — Competidores y terceros:** qué rivales y sitios de autoridad aparecen.
- **V4 — Oportunidades de contenido:** preguntas donde la marca no figura pero los rivales sí, o donde la IA responde sin citar fuentes.

### Requisitos de arquitectura y entrega

- Arquitectura desacoplada que permita **añadir proveedores fácilmente** (interfaz o factoría).
- **Sin claves API en el código**; uso de variables de entorno.
- Archivo **`.env.example`** explicativo.
- Instrucciones de configuración, decisiones de arquitectura y notas de honestidad sobre las integraciones.

---

## Sección 2 — Lo que el sistema ya tiene (cumplimiento real)

Cada requisito, con su estado, los archivos donde está implementado y cómo se resolvió.

### 1. Cargar empresa — ✅ Cumplido

- **Archivos:** `components/ProjectForm.tsx`, `app/api/projects/route.ts`, `lib/db.ts`.
- **Resolución:** el formulario recolecta nombre, dominio, descripción de categoría y competidores (separados por coma). El dominio se normaliza al ingreso —se quitan `http(s)://` y `www.` y se pasa a minúsculas— y se persiste en la tabla `projects`. Los competidores se parten por coma, se limpian y se descartan los vacíos.

### 2. Generar 5–8 preguntas de intención de compra — ✅ Cumplido

- **Archivos:** `lib/questions.ts`, `app/api/questions/route.ts`, `components/AuditWizard.tsx`.
- **Resolución:** el sistema genera 6 preguntas contextualizadas mediante Google Gemini (`gemini-1.5-flash`). Si no hay credenciales, cae a un generador de plantillas local (`getFallbackQuestions`). Las preguntas son editables: agregar, quitar y reescribir antes de correr la auditoría, con etiqueta de origen (IA / Manual).

### 3. Ejecutar auditoría contra un proveedor — ✅ Cumplido

- **Archivos:** `app/api/audit/route.ts`, `app/api/audit/single/route.ts`, `lib/providers/index.ts`.
- **Resolución:** se inicia una corrida (`audit_runs`) y se ejecuta cada pregunta contra el endpoint `/api/audit/single`. La ejecución pregunta por pregunta permite reportar el progreso real a medida que cada llamada se completa.

### 4. Extraer URLs/dominios de las respuestas — ✅ Cumplido

- **Archivos:** `lib/citations.ts`, `app/api/audit/single/route.ts`.
- **Resolución:** por cada respuesta, el servidor limpia las URLs citadas y extrae el dominio con `normalizeDomain(url)`. Luego `classifyDomain(...)` etiqueta cada dominio como marca propia (`target`), competidor (`competitor`), sitio de reseñas (`review`), publicación/medio (`publication`) o genérico (`other`). Las URLs inválidas se descartan sin abortar el proceso.
- **Nota de comportamiento:** `normalizeDomain` quita `www.` pero **no colapsa subdominios**, así que `blog.ejemplo.com` y `ejemplo.com` se cuentan por separado en el ranking de dominios. Esto es una decisión de alcance deliberada (ver "Decisiones de alcance"), no un descuido: la clasificación (`classifyDomain`) sí reconoce el subdominio cuando termina en el dominio base del target o de un competidor.

### 5. Panel visual (dashboard) — ✅ Cumplido

- **Archivos:** `components/DashboardView.tsx`, `lib/analytics.ts`.
- **Resolución por vista:**
  - **V1 — Dominios más citados:** gráfico de barras horizontal (Recharts) con el Top 10 de dominios por cantidad de apariciones.
  - **V2 — Presencia de la empresa:** *Share of Voice* en la tarjeta principal, calculado como el porcentaje de preguntas en las que la marca objetivo fue citada.
  - **V3 — Competidores y terceros:** cuadrícula comparativa entre la marca propia y los competidores (presencia en IA, cantidad de citas, reseñas y cobertura editorial).
  - **V4 — Oportunidades de contenido:** lista de preguntas donde la marca está ausente pero aparecen competidores, con una acción de contenido sugerida.

### Nota de honestidad — progreso de la auditoría

Hay dos flujos y se comportan distinto, conviene aclararlo:

- En el asistente paso a paso (`components/AuditWizard.tsx`), el progreso y los logs reflejan **en tiempo real** cada llamada HTTP completada, porque la ejecución es pregunta por pregunta.
- En el editor secundario de preguntas (`components/QuestionsEditor.tsx`), la barra de progreso y los logs son **simulados** con un `setInterval` del lado cliente para dar feedback mientras la API procesa la petición global. No reflejan el avance real consulta por consulta.

---

## Sección 3 — Propuesta agregada (por encima del mínimo)

Funcionalidades que el reto no pedía pero que están implementadas y verificadas en el código.

1. **Historial de auditorías por proyecto** — `components/ProjectDetailView.tsx`. Registra múltiples corridas en el tiempo con sus estados (`pending`, `running`, `completed`, `failed`) y acceso directo a reportes anteriores. La herramienta no es de un solo uso.

2. **Gráfico de evolución del Share of Voice** — `components/ProjectDetailView.tsx`. Una línea temporal (Recharts) con la tendencia de la presencia de la marca a lo largo de las corridas, para evaluar el impacto de cambios de contenido.

3. **Integración con tres motores reales** — `lib/providers/perplexity.ts`, `lib/providers/openai.ts`, `lib/providers/gemini.ts`. Además del mock, soporta consultas y parseo de citas en vivo contra Perplexity Sonar, OpenAI (`gpt-4o` con búsqueda) y Google Gemini (`gemini-1.5-flash` con grounding).

4. **Selector de motor para generar preguntas** — `lib/questions.ts`, `components/AuditWizard.tsx`. El usuario elige con qué motor generar las preguntas iniciales (Gemini, OpenAI, Perplexity o plantilla local), con Gemini por defecto.

5. **Modal de diagnóstico / preview** — `components/AuditWizard.tsx`. Permite probar una pregunta suelta contra cualquiera de los motores y ver las citas clasificadas antes de correr la auditoría completa, sin ensuciar el historial.

6. **Detección de competidores no declarados** — `lib/analytics.ts` (`detectedPotentialCompetitors`). Identifica marcas rivales citadas por la IA que el usuario no registró, y ofrece agregarlas al monitoreo. (Una versión simple de la "detección automática de competidores" que el reto sugería como mejora futura.)

7. **Interfaz bilingüe ES/EN persistente** — `lib/translations.ts` y componentes. Traduce toda la experiencia, incluidas las recomendaciones, con el idioma guardado en `localStorage`.

8. **Eliminación de proyectos en cascada** — `lib/db.ts` (`deleteProject`). Borra un proyecto y, en cascada, sus preguntas, corridas, respuestas y citas asociadas.

---

## Configuración

```bash
npm install
npm run dev
```

Sin claves, la app corre con generación de preguntas por plantilla y proveedor mock. Para usar motores reales, copiar `.env.example` a `.env` y completar las claves necesarias:

```
PERPLEXITY_API_KEY=...   # auditoría con búsqueda web real
OPENAI_API_KEY=...       # auditoría / generación con OpenAI
GEMINI_API_KEY=...       # generación de preguntas y grounding
```

No hay claves en el código; todas se leen de variables de entorno.

---

## Resumen de cumplimiento

| Requisito del reto | Estado | Archivo(s) clave |
| :--- | :---: | :--- |
| Cargar datos de empresa | ✅ | `components/ProjectForm.tsx` |
| Generación de preguntas de compra | ✅ | `lib/questions.ts` |
| Integración de proveedores de IA | ✅ | `lib/providers/index.ts` |
| Extracción y normalización de citas | ✅ | `lib/citations.ts` |
| V1 · Dominios más citados | ✅ | `components/DashboardView.tsx` |
| V2 · Share of Voice de la marca | ✅ | `lib/analytics.ts` |
| V3 · Comparativa competidores/terceros | ✅ | `components/DashboardView.tsx` |
| V4 · Oportunidades de contenido | ✅ | `lib/analytics.ts` |
| Arquitectura extensible de proveedores | ✅ | `lib/providers/index.ts` |
| Variables de entorno y `.env.example` | ✅ | `.env.example` |

### Decisiones de alcance

- **Sin crawler propio.** No incluí un bot para leer en vivo el contenido de las URLs citadas, para evitar bloqueos (captchas, Cloudflare) y mantener tiempos de respuesta razonables. La extracción se delega a los motores de IA, que ya devuelven las citas estructuradas.
- **Subdominios sin colapsar.** En el ranking de dominios, `blog.hubspot.com` y `hubspot.com` figuran como ítems distintos, a propósito: da visibilidad de qué sección del sitio del competidor concentra la tracción en IA. La clasificación contra target/competidores sí resuelve el dominio base. Consolidar subdominios en el conteo queda como ajuste futuro si se prefiere la vista agregada.
- **Progreso simulado en el editor secundario.** Documentado arriba; el flujo principal del asistente sí reporta progreso real.

### Qué construiría a continuación

- Progreso real con streaming también en el editor secundario.
- Comparación lado a lado del *Share of Voice* entre los tres motores en una misma corrida.
- Automatizar las corridas periódicas (el histórico ya existe; falta programarlas) y alertar cuando cae la visibilidad.
- Distinguir **mención** (la marca nombrada en el texto) de **cita** (el dominio como fuente).
- Exportación de informes a PDF.

---

## Timebox y decisiones de alcance

Para este proyecto se invirtieron aproximadamente **[COMPLETAR: horas aproximadas] horas** en total, excediendo el rango sugerido de 4–8 horas debido a la decisión de implementar una solución robusta y lista para producción en lugar de un MVP básico.

El foco principal del esfuerzo se destinó a asegurar el núcleo del reto (el correcto funcionamiento de los 5 módulos obligatorios y el desarrollo preciso de las 4 vistas del panel). Con el objetivo de presentar una entrega destacada y robusta, se incorporaron funcionalidades extra (como la integración con tres motores reales de IA con búsqueda web, el historial persistente de auditorías, el gráfico de evolución del Share of Voice, la traducción bilingüe, la detección de competidores no declarados en el radar, la previsualización individual de consultas y el borrado de proyectos en cascada). Sin embargo, para no dilatar el desarrollo indefinidamente, estos agregados de valor se sumaron con un alcance acotado y controlado (tradeoffs de timebox), dejando implementaciones más complejas (como cron-jobs para corridas automáticas, ponderación de la cita por posición dentro del texto, o crawlers dedicados para evadir restricciones de red de terceros) catalogadas para futuras iteraciones en el roadmap.
