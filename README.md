# Panel de Visibilidad de Citas de IA (GEO/AEO Dashboard)

Esta aplicación es una demostración técnica interactiva para auditar el **Share of Voice (SOV)** de una marca en buscadores conversacionales de IA (como Perplexity, Gemini, ChatGPT Search). Permite definir una empresa objetivo, generar preguntas de intención de compra del embudo, consultar un proveedor de IA con búsqueda web, normalizar/clasificar las fuentes citadas, y visualizar oportunidades de contenido para optimización de motores generativos (GEO / Generative Engine Optimization).

---

## ⚙️ Configuración Avanzada (Red & Motores de IA Reales)

Para activar la ejecución con motores de búsqueda de IA reales o conectar la base de datos de producción, duplica el archivo `.env.example` como `.env` e ingresa tus claves:

```bash
cp .env.example .env
```

### Opciones de Entorno y Variables (.env)

| Variable | Tipo / Valor | Descripción |
|---|---|---|
| `CITATION_PROVIDER` | `mock`, `perplexity`, `openai` o `gemini` | Motor de citas por defecto para auditorías generales de fondo de embudo. |
| `PERPLEXITY_API_KEY` | `pplx-xxxxxxxx` | Clave API de Perplexity. Utiliza el modelo `sonar` con búsquedas web en tiempo real. |
| `OPENAI_API_KEY` | `sk-proj-xxxxxx` | Clave API de OpenAI. Utiliza el modelo `gpt-4o` con indexación y formato de respuesta estructurado. |
| `GEMINI_API_KEY` | `AIzaSyxxxxxxxx` | Clave API de Google Gemini. Utiliza `gemini-1.5-flash` con la herramienta Google Search Grounding activada. |
| `SUPABASE_URL` | `https://xxxxxx.supabase.co` | URL de Supabase para activar persistencia en Postgres en producción. |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsIn...` | Clave de servicio para omitir restricciones RLS en llamadas de servidor. |

> [!TIP]
> **Persistencia Local Segura**: También puedes ingresar tus API Keys de manera segura y directa desde la propia interfaz de usuario del panel web. Las claves se guardarán localmente de forma encriptada en el almacenamiento local (`localStorage`) de tu navegador, enviándose al servidor de Next.js únicamente mediante cabeceras seguras temporales (`x-perplexity-key`, `x-openai-key`, `x-gemini-key`), evitando su almacenamiento en los servidores de la aplicación.

---

## 🏛️ Decisiones de Arquitectura

1. **Abstracción de Proveedores (`lib/providers/`):**
   Toda interacción con motores de IA se aísla detrás de la interfaz `CitationProvider` y una factoría (`index.ts`). El resto del sistema interactúa de manera transparente con las respuestas del proveedor simulado (`MockProvider`), Perplexity Sonar, OpenAI Search (`gpt-4o` con respuesta JSON) o Google Gemini (Grounding de Búsqueda de Google en vivo).
   
2. **Base de Datos Híbrida Inteligente (`lib/db.ts`):**
   La persistencia está aislada para que cambiar de motor sea transparente.
   - **SQLite (`better-sqlite3`):** Se usa por defecto. Guarda los datos localmente en `local.db`, ideal para pruebas locales y empaquetado ZIP sin setup.
   - **Supabase:** Se activa automáticamente si las variables de entorno están declaradas en `.env`, haciéndola compatible con deploys en la nube (ej. Vercel).
   
3. **Persistencia e Historial Cruzado Multimotor:**
   El motor de auditoría permite seleccionar múltiples motores de búsqueda en simultáneo y ejecutarlos de forma secuencial. Los resultados de cada corrida se guardan en la base de datos de manera relacional (auditorías, respuestas y citaciones en tablas vinculadas mediante restricciones de cascada `ON DELETE CASCADE`).

4. **Clasificación y Normalización de Citas (`lib/citations.ts`):**
   Las URLs se limpian (removiendo esquemas y prefijos `www.`) y se agrupan en categorías semánticas:
   - `target`: Dominio de la empresa objetivo.
   - `competitor`: Coincide con la lista de competidores monitoreados del proyecto.
   - `review`: Plataformas populares de opiniones (G2, Capterra, Reddit, Clutch).
   - `publication`: Artículos de prensa, enciclopedias o blogs (Wikipedia, Medium, Forbes).
   - `other`: Otros enlaces genéricos.

---

## 💎 Funcionalidades de Valor Agregado

Además de los requisitos del reto básico, la aplicación ya incluye:
- **Evolución del Share of Voice (SOV) en el tiempo**: Un gráfico de tendencias interactivo (`LineChart` de Recharts) que muestra el rendimiento de visibilidad de la marca a lo largo de todas las auditorías completadas del historial.
- **Detección Automática de Competidores**: El sistema identifica dominios citados recurrentemente por la IA que no se encuentran en tu lista original y provee un botón rápido para agregarlos al monitoreo.
- **Diagnóstico y Vista de Prueba Rápida (Preview Modal)**: Permite probar en tiempo real cualquier pregunta generada en el Paso 2 contra cualquiera de las 4 IAs y visualizar la respuesta estructurada antes de lanzar la auditoría general.
- **Soporte Multilingüe ES/EN**: Traducción íntegra de la interfaz y las recomendaciones de SEO predictivo basada en el idioma de preferencia del usuario persistido en `localStorage`.
- **Eliminación Segura**: Control de mantenimiento de proyectos directo en la UI con borrado limpio en cascada en la base de datos.
- **Selector de Motor en Paso 2**: Permite elegir qué motor (Gemini, OpenAI, Perplexity o Plantilla local) generará la lista de preguntas inicial.

---

## 🎯 Próximos Pasos (Roadmap de Producto)

Si continuáramos el desarrollo hacia un SaaS comercial, priorizaríamos:
1. **Ponderación por Posición y Contexto:**
   Ponderar las citas según su jerarquía en la respuesta de la IA (por ejemplo, si el enlace aparece en el primer párrafo o como nota al pie).
2. **Alertas de Caída de Visibilidad (Alerting Engine):**
   Notificar a los especialistas de marketing mediante webhooks o correos electrónicos si el Share of Voice (SOV) disminuye de forma repentina en algún motor clave en la última semana.

