# Panel de Visibilidad de Citas de IA (GEO/AEO Dashboard)

Esta aplicación es una demostración técnica interactiva para auditar el **Share of Voice (SOV)** de una marca en buscadores conversacionales de IA (como Perplexity, Gemini, ChatGPT Search). Permite definir una empresa objetivo, generar preguntas de intención de compra del embudo, consultar un proveedor de IA con búsqueda web, normalizar/clasificar las fuentes citadas, y visualizar oportunidades de contenido para optimización de motores generativos (GEO / Generative Engine Optimization).

---

## 🚀 Inicio Rápido (Zero-Configuration Mode)

La aplicación está diseñada para ejecutarse **100% de manera local y offline**, sin depender de API keys ni servicios de red de manera obligatoria.

### 1. Clonar e Instalar
```bash
# Instalar las dependencias
npm install
```

### 2. Ejecutar el Servidor de Desarrollo
```bash
npm run dev
```

### 3. Probar el Happy Path
1. Abre tu navegador en [http://localhost:3000](http://localhost:3000).
2. Verás el indicador **Base de Datos: SQLite Local** en el header.
3. Completa el formulario de configuración:
   - **Empresa:** `Atlas Copco`
   - **Dominio:** `atlascopco.com`
   - **Descripción:** `compresores de aire industriales y herramientas de energía`
   - **Competidores:** `ingersollrand.com, kaeser.com`
4. Presiona **Crear Proyecto**.
5. Se generarán 6 preguntas del funnel. Presiona **Ejecutar Auditoría**.
6. Observa la animación con los logs del motor. Al completarse, se te redirigirá automáticamente al **Dashboard de Visibilidad** con gráficos de barras, gráficos de pastel, recomendaciones automáticas y desglose detallado de respuestas.

---

## ⚙️ Configuración Avanzada (Red & Producción)

Para activar el proveedor real de búsqueda conversacional o conectar la base de datos de producción, duplica el archivo `.env.example` como `.env` e ingresa tus claves:

```bash
cp .env.example .env
```

### Opciones de Entorno

| Variable | Tipo / Valor | Descripción |
|---|---|---|
| `CITATION_PROVIDER` | `mock` o `perplexity` | Elige el proveedor de respuestas. Si es `perplexity`, requiere la API key de Perplexity. |
| `PERPLEXITY_API_KEY` | `pplx-xxxxxxxx` | Clave API de Perplexity. Utiliza el modelo `sonar` que devuelve citas estructuradas. |
| `GEMINI_API_KEY` | `AIzaSyxxxxxxxx` | Opcional. Permite autogenerar las preguntas usando IA real (`gemini-1.5-flash`). Si no se define, se usa la plantilla local. |
| `SUPABASE_URL` | `https://xxxxxx.supabase.co` | URL de Supabase para activar persistencia en Postgres. |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsIn...` | Clave de servicio para omitir restricciones RLS en llamadas de servidor. |

---

## 🏛️ Decisiones de Arquitectura

1. **Abstracción de Proveedores (`lib/providers/`):**
   Toda interacción con motores de IA se aísla detrás de la interfaz `CitationProvider` y una factory (`index.ts`). El resto del sistema no sabe si está interactuando con respuestas simuladas, Perplexity Sonar, OpenAI con Search o Gemini Grounding. Agregar un motor futuro solo requiere crear un archivo que implemente la interfaz.
   
2. **Base de Datos Híbrida Inteligente (`lib/db.ts`):**
   La persistencia está aislada para que cambiar de motor sea transparente.
   - **SQLite (`better-sqlite3`):** Se usa por defecto. Guarda los datos localmente en `local.db`, ideal para pruebas locales y empaquetado ZIP sin setup.
   - **Supabase:** Se activa automáticamente si las variables de entorno están declaradas en `.env`, haciéndola compatible con deploys serverless en Vercel.

3. **Generación con Fallback Seguro (`lib/questions.ts`):**
   Si la API key de Gemini no está disponible o falla la conexión, la aplicación genera dinámicamente un cuestionario estructurado basado en plantillas del funnel de compra (descubrimiento, comparación, criterios de selección).

4. **Clasificación de Citas por Reglas Heurísticas (`lib/citations.ts`):**
   Las URLs se normalizan (quitar `www.`, limpiar rutas) y se clasifican en:
   - `target`: Dominio de la empresa objetivo.
   - `competitor`: Coincide con la lista de competidores definidos.
   - `review`: Plataformas populares de opiniones (G2, Capterra, Reddit).
   - `publication`: Artículos de prensa, enciclopedias o blogs (Wikipedia, Medium, TechCrunch).
   - `other`: Otros enlaces.

---

## 🎯 Próximos Pasos (Roadmap de Producto)

Si continuáramos el desarrollo hacia un SaaS comercial, priorizaríamos:

1. **Share of Voice Cruzado (Multi-Motor en Paralelo):**
   Ejecutar la misma pregunta simultáneamente contra Perplexity, ChatGPT Search y Gemini Grounding. Esto es clave porque los clientes quieren saber cómo se posicionan en los diferentes ecosistemas que usan los consumidores.
   
2. **Histórico y Monitoreo Programado:**
   Programar cronjobs semanales para ejecutar las auditorías y mostrar gráficos de evolución temporal del Share of Voice (la métrica principal que justifica la inversión en GEO).

3. **Ponderación por Posición y Contexto:**
   No todas las citas valen lo mismo. Ponderar las citas según su jerarquía en la respuesta de la IA (por ejemplo, si el enlace aparece en el primer párrafo o como nota al pie).

4. **Autodescubrimiento y Enriquecimiento de Competidores:**
   Identificar de forma automatizada los dominios más citados recurrentemente que no pertenezcan a publicaciones ni plataformas de opiniones, sugiriéndolos al usuario como competidores directos para agregarlos a su set de tracking.
