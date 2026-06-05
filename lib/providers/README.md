# Guía del Desarrollador: Integración de Nuevos Proveedores (Citation Providers)

Este directorio gestiona la conexión con los diferentes motores de búsqueda generativa e IA (`perplexity`, `mock`, etc.). Toda la lógica de extracción de citas y generación de respuestas está aislada detrás de una interfaz desacoplada. El resto de la aplicación no conoce el motor real utilizado, lo que permite añadir o cambiar proveedores de forma rápida.

---

## Estructura de la Arquitectura

La arquitectura de proveedores se basa en tres pilares principales:

1. **`types.ts`**: Define la interfaz `CitationProvider` y las firmas de datos comunes para citas (`Citation`) y respuestas (`ProviderResponse`).
2. **Factory (`index.ts`)**: Expone la función `getProvider` que inicializa el motor adecuado según las variables de entorno o configuraciones del proyecto.
3. **Implementación de Clases**: Cada motor (ej. `PerplexitySonarProvider` en `perplexity.ts`) implementa de forma independiente la interfaz `CitationProvider`.

---

## Paso a Paso: Cómo Agregar un Nuevo Proveedor (Ejemplo: OpenAI con Búsqueda o Gemini Grounding)

Sigue estos 5 pasos para integrar un nuevo motor de IA en el sistema:

### Paso 1: Definir las Variables de Entorno
Añade las variables de entorno necesarias para el nuevo motor en tu archivo `.env` y regístralas de forma segura en `.env.example` sin valores reales (nombres vacíos):

```bash
# .env.example
# Proveedor de citas: "mock", "perplexity" o "openai"
CITATION_PROVIDER=mock

# Clave del nuevo proveedor
OPENAI_API_KEY=
```

### Paso 2: Crear la Clase de Proveedor
Crea un nuevo archivo en este directorio (ej. `lib/providers/openai.ts`) e implementa la interfaz `CitationProvider`:

```typescript
// lib/providers/openai.ts
import { CitationProvider, ProviderResponse, Citation } from "./types";

export class OpenAISearchProvider implements CitationProvider {
  readonly name = "openai";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async query(question: string): Promise<ProviderResponse> {
    try {
      // 1. Realizar petición HTTP al API de OpenAI con habilitación de búsqueda web
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o", // O el modelo con capacidad de búsqueda activa
          messages: [{ role: "user", content: question }],
          // Habilitar la herramienta de búsqueda de OpenAI si aplica
          tools: [{ type: "web_search" }] 
        })
      });

      if (!res.ok) {
        throw new Error(`OpenAI API returned status ${res.status}`);
      }

      const data = await res.json();
      const answer = data.choices[0]?.message?.content || "";
      
      // 2. Extraer citas generadas por el motor
      const rawCitations = data.choices[0]?.message?.tool_calls || [];
      const citations: Citation[] = rawCitations.map((c: any) => {
        const url = c.web_search?.url || "";
        const domain = url ? new URL(url).hostname.replace(/^www\./, "") : "";
        return {
          url,
          domain,
          title: c.web_search?.title || domain
        };
      });

      return {
        answer,
        citations,
        provider: this.name,
        raw: data // Se adjunta para depuración en el Inspector de JSON Crudo
      };
    } catch (error: any) {
      console.error("OpenAI Provider Error:", error);
      return {
        answer: "",
        citations: [],
        provider: this.name,
        raw: { error: error.message }
      };
    }
  }
}
```

### Paso 3: Registrar el Proveedor en la Factory
Abre `lib/providers/index.ts` e importa tu nueva clase. Regístrala dentro de la función `getProvider`:

```typescript
// lib/providers/index.ts
import { OpenAISearchProvider } from "./openai"; // <-- Importar

export function getProvider(
  providerName: string = process.env.CITATION_PROVIDER || "mock",
  config?: ProviderConfig,
  overrideApiKey?: string
): CitationProvider {
  const selectedProvider = providerName.toLowerCase();

  switch (selectedProvider) {
    case "perplexity":
      // ...
    
    case "openai": // <-- Registrar caso
      const openaiKey = overrideApiKey || process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        console.warn("OPENAI_API_KEY not found. Falling back to MockProvider.");
        return new MockProvider(config?.targetCompany, config?.targetDomain, config?.competitors);
      }
      return new OpenAISearchProvider(openaiKey);

    case "mock":
    default:
      return new MockProvider(config?.targetCompany, config?.targetDomain, config?.competitors);
  }
}
```

### Paso 4: Añadir Soporte en el Wizard y Configuración del Frontend
Abre `components/AuditWizard.tsx` para permitir al usuario seleccionar el nuevo motor en el paso 3 (Configuración de Ejecución) e introducir su clave de API personalizada en la pestaña de Configuración:

1. **Selector de proveedor**: Añade `"openai"` a los tipos de proveedores aceptados y agrega la opción gráfica correspondiente en el grid de selección.
2. **Traducciones**: Define las cadenas del nuevo motor en `lib/translations.ts` para mostrar descripciones claras del diagnóstico de este motor en español e inglés.

---

## Reglas de Seguridad

1. **NUNCA escribas API keys directamente en el código**. Las claves de desarrollo de testing deben guardarse exclusivamente en tu archivo local `.env` (el cual está listado en `.gitignore` para prevenir fugas accidentales a repositorios públicos).
2. **Soporte Override**: Permite siempre que el usuario introduzca sus claves API directamente en la interfaz del navegador (`localStorage`) para que la consola funcione en entornos compartidos de forma descentralizada.
