# Guía de Operación y Manual de Módulos (AI Citation Visibility Dashboard)

Este documento detalla el funcionamiento de cada uno de los módulos clave del sistema, cómo operarlos paso a paso, y cómo están vinculados a los archivos de código fuente en el repositorio.

---

## Módulo 1: Registro y Configuración de Empresa (Paso 1)
Este módulo captura el perfil comercial de la marca objetivo y sus competidores directos para estructurar la auditoría.

### Cómo Operarlo:
1. **Identidad de Marca:** Ingresa el **Nombre de la Empresa** (ej: *Apple*) y el **Dominio Web Primario** (ej: *apple.com*).
2. **Posicionamiento:** Agrega la **Descripción de Servicios o Productos** y completa la industria y público objetivo. *Nota: La calidad de las preguntas generadas depende de la precisión de esta descripción.*
3. **Competidores:** Agrega una lista de dominios web de competidores separados por comas (ej: *google.com, microsoft.com*).
4. Haz clic en **Continuar** para guardar los datos. Si la base de datos está disponible, el sistema autoguardará el borrador para que no pierdas el progreso.

### Archivos Vinculados:
* **Vista Frontend:** Formulario principal en [AuditWizard.tsx](file:///Users/seleniasanchez/Desktop/Documents/IA%20RANKING/components/AuditWizard.tsx#L445-L630).
* **Base de Datos:** Funciones `createProject`, `getProject` y `autosaveProject` en [db.ts](file:///Users/seleniasanchez/Desktop/Documents/IA%20RANKING/lib/db.ts#L121).
* **Controlador API:** Endpoint POST/PUT en [projects/route.ts](file:///Users/seleniasanchez/Desktop/Documents/IA%20RANKING/app/api/projects/route.ts#L26).

---

## Módulo 2: Generador y Editor de Cuestionario (Paso 2)
Permite modelar las preguntas de intención de compra de los usuarios que serán testeadas en los buscadores de IA.

### Cómo Operarlo:
1. **Motor de IA / Generador:** Elige entre **Google Gemini**, **OpenAI Search**, **Perplexity** o el **Simulador Local (Plantilla)** en el panel de gestión.
2. **Uso de Claves (API Override):** Si seleccionas un motor de IA real y no tienes configurada la clave en el servidor, ingresa la clave de API en el campo de texto seguro (Override).
3. **Usar el Simulador Gratis:** Si no tienes claves de API, presiona el botón **`→ Usar Simulador Local Gratis`**. El sistema activará el simulador local para omitir llamadas a internet sin lanzar errores.
4. **Regenerar:** Haz clic en **Regenerar con IA** para obtener un cuestionario optimizado de 6 preguntas distribuidas por categorías de funnel (Informational, Comparison, Commercial, High Intent).
5. **Edición Manual:** Puedes editar el texto de cualquier pregunta en tiempo real, presionar **Agregar Pregunta** para crear una personalizada, o el icono de papelera para eliminarla.

### Archivos Vinculados:
* **UI de Gestión:** Bloque central y tabla de preguntas en [AuditWizard.tsx](file:///Users/seleniasanchez/Desktop/Documents/IA%20RANKING/components/AuditWizard.tsx#L2280-L2390).
* **Generación Backend:** Lógica y prompts en [questions.ts](file:///Users/seleniasanchez/Desktop/Documents/IA%20RANKING/lib/questions.ts#L33).
* **Controlador API:** Endpoint POST/PUT en [questions/route.ts](file:///Users/seleniasanchez/Desktop/Documents/IA%20RANKING/app/api/questions/route.ts#L42).

---

## Módulo 3: Ejecutor de Auditoría y Rastreo (Paso 3)
Se encarga de enviar las preguntas a los distintos motores y registrar las respuestas junto con sus enlaces de citas web.

### Cómo Operarlo:
1. **Selección de Motores:** Marca los proveedores que deseas auditar simultáneamente (puedes seleccionar varios para compararlos).
2. **Ejecución:** Haz clic en **Iniciar Análisis de Visibilidad**.
3. **Consola en Vivo:** Visualizarás una consola de diagnóstico en tiempo real con barras de progreso que detallan qué pregunta se está evaluando, el tiempo estimado y el resultado de la cita.
4. **Respaldo Automático (Fallback):** Si dejas una API key vacía o la llamada falla, el sistema correrá automáticamente el módulo simulador ([MockProvider](file:///Users/seleniasanchez/Desktop/Documents/IA%20RANKING/lib/providers/mock.ts)) para completar la auditoría sin romper la interfaz.

### Archivos Vinculados:
* **Control de Consola:** Flujo de ejecución secuencial en [AuditWizard.tsx](file:///Users/seleniasanchez/Desktop/Documents/IA%20RANKING/components/AuditWizard.tsx#L906-L1030).
* **Proveedores de Citas:** Módulo polimórfico [providers/](file:///Users/seleniasanchez/Desktop/Documents/IA%20RANKING/lib/providers) ([gemini.ts](file:///Users/seleniasanchez/Desktop/Documents/IA%20RANKING/lib/providers/gemini.ts), [openai.ts](file:///Users/seleniasanchez/Desktop/Documents/IA%20RANKING/lib/providers/openai.ts), [perplexity.ts](file:///Users/seleniasanchez/Desktop/Documents/IA%20RANKING/lib/providers/perplexity.ts), [mock.ts](file:///Users/seleniasanchez/Desktop/Documents/IA%20RANKING/lib/providers/mock.ts)).
* **Controlador API:** Endpoints en [audit/route.ts](file:///Users/seleniasanchez/Desktop/Documents/IA%20RANKING/app/api/audit/route.ts) y [single/route.ts](file:///Users/seleniasanchez/Desktop/Documents/IA%20RANKING/app/api/audit/single/route.ts).

---

## Módulo 4: Dashboard y Métricas de Share of Voice (Paso 4 y 5)
Calcula la visibilidad real de la marca a partir de las citas web recopiladas.

### Cómo Operarlo:
1. **Filtro de Motores:** Haz clic en **ALL**, **PERPLEXITY**, **OPENAI SEARCH**, **GOOGLE GEMINI** o **MOCK DATA** para filtrar los gráficos y tablas según la IA seleccionada.
2. **Visualizar Indicadores:**
   * **Share of Voice (SOV):** Porcentaje de consultas donde tu sitio web fue citado.
   * **Most Cited Domains:** Ranking de los 10 sitios más recomendados por la IA.
   * **Content Opportunities:** Listado de preguntas críticas donde tu marca no figura.
3. **Navegar Pestañas:**
   * *Executive Summary & SOV:* Gráficos principales de participación.
   * *Analysis per Query:* Vista de las respuestas textuales y citas extraídas por cada pregunta.
   * *Competitive Diagnosis:* Diagnóstico comparativo automático.
   * *Recommendations & Gaps:* Pasos recomendados de optimización (AEO/GEO).
   * *Engine Comparison:* Comparación matricial de rendimiento entre IAs.

### Archivos Vinculados:
* **UI del Dashboard:** Renderizado de gráficos y pestañas en [DashboardView.tsx](file:///Users/seleniasanchez/Desktop/Documents/IA%20RANKING/components/DashboardView.tsx).
* **Cálculo de Métricas:** Fórmulas de SOV y visibilidad en [analytics.ts](file:///Users/seleniasanchez/Desktop/Documents/IA%20RANKING/lib/analytics.ts#L194).
* **Clasificación de Enlaces:** Lógica en [citations.ts](file:///Users/seleniasanchez/Desktop/Documents/IA%20RANKING/lib/citations.ts#L91).
* **Controlador API:** Agrupación y formateo de datos en [dashboard/route.ts](file:///Users/seleniasanchez/Desktop/Documents/IA%20RANKING/app/api/dashboard/route.ts).

---

## Módulo 5: Historial y Gestión de Proyectos
Permite reutilizar configuraciones previas y descargar reportes.

### Cómo Operarlo:
1. Navega a la pestaña de **Projects** o **History** en la barra lateral izquierda.
2. Selecciona un proyecto guardado para continuar su configuración o ver sus reportes previos.
3. En la barra superior del dashboard, haz clic en **Export JSON** para descargar el reporte de auditoría completo y compartirlo.

### Archivos Vinculados:
* **UI de Historial:** Listado y restaurador en [AuditWizard.tsx](file:///Users/seleniasanchez/Desktop/Documents/IA%20RANKING/components/AuditWizard.tsx#L191-L327).
* **Consultas de Base de Datos:** Métodos `getProjects` y `getAuditRunDetails` en [db.ts](file:///Users/seleniasanchez/Desktop/Documents/IA%20RANKING/lib/db.ts#L236).
