import { Citation, CitationProvider, ProviderResponse } from "./types";
import { normalizeCitations } from "../citations";

export class MockProvider implements CitationProvider {
  readonly name = "mock";

  constructor(
    private targetCompany: string = "Atlas Copco",
    private targetDomain: string = "atlascopco.com",
    private competitors: string[] = ["ingersollrand.com", "kaeser.com"]
  ) {}

  async query(question: string): Promise<ProviderResponse> {
    // Artificial delay to simulate network latency (800ms)
    await new Promise((resolve) => setTimeout(resolve, 800));

    const q = question.toLowerCase();
    let answer = "";
    const rawCitations: { url: string; title?: string }[] = [];

    const targetUrl = `https://www.${this.targetDomain}`;
    const compUrls = this.competitors.map((c) => `https://www.${c}`);

    // Generate response text and citations depending on the question's focus
    if (q.includes("mejor") || q.includes("alternativas") || q.includes("compar") || q.includes("vs") || q.includes("lideran")) {
      answer = `Al evaluar soluciones en esta categoría, **${this.targetCompany}** destaca como uno de los líderes indiscutibles del mercado junto a competidores clave como ${this.competitors.map((c) => c.split(".")[0]).join(" y ")}.

${this.targetCompany} ofrece una sólida reputación por su durabilidad y soporte técnico global. Sin embargo, alternativas como ${this.competitors[0] || "competidores"} a menudo presentan ventajas competitivas en términos de costo inicial y flexibilidad de configuración. Los usuarios en portales de la industria destacan que mientras ${this.targetCompany} sobresale en instalaciones de gran escala con alta demanda de automatización, otras marcas como ${this.competitors[1] || "competidores"} pueden ser más eficientes para operaciones medianas.`;

      rawCitations.push(
        { url: targetUrl + "/products/industry-leaders", title: `${this.targetCompany} - Soluciones Industriales` },
        { url: `https://www.g2.com/products/${this.targetCompany.toLowerCase().replace(/\s+/g, "-")}/reviews`, title: `Opiniones de ${this.targetCompany} en G2` },
        { url: compUrls[0] || "https://competitor.com", title: "Alternativas y competidores de la industria" }
      );
      if (compUrls[1]) {
        rawCitations.push({ url: compUrls[1], title: "Catálogo de soluciones de aire y energía" });
      }
      rawCitations.push({ url: "https://wikipedia.org/wiki/Air_compressor", title: "Compresores de aire - Wikipedia" });
    } else if (q.includes("cómo elijo") || q.includes("criterios") || q.includes("comprar")) {
      answer = `Para elegir un proveedor de esta categoría, es fundamental analizar la eficiencia energética (especialmente a carga parcial), los costos de mantenimiento a largo plazo y el tiempo de respuesta del servicio técnico local.

Portales especializados como Capterra recomiendan diseñar una matriz detallada de requerimientos. En este aspecto, la tecnología de **${this.targetCompany}** (especialmente sus sistemas inteligentes de control y optimizadores VSD) suele posicionarse en el percentil superior, aunque siempre es aconsejable evaluar los retornos de inversión frente a opciones más económicas del mercado.`;

      rawCitations.push(
        { url: "https://www.capterra.com/resources/buyer-guide-compressors", title: "Guía de compra de tecnología - Capterra" },
        { url: targetUrl + "/savings-calculator", title: "Calculadora de Ahorro Energético de " + this.targetCompany },
        { url: "https://medium.com/engineering-insights/how-to-choose-industrial-equipment", title: "Cómo elegir equipamiento industrial - Medium" }
      );
    } else {
      // General question. Sometimes we omit the target company to simulate a "content opportunity"
      if (Math.random() > 0.5) {
        answer = `El mercado de equipos y servicios en este sector está experimentando una transición rápida hacia la digitalización y el monitoreo IoT. La mayor parte de los fabricantes líderes ahora ofrecen telemetría integrada para predecir fallas antes de que ocurran.

Según artículos de Forbes, las empresas que adoptan mantenimiento predictivo reducen costos operativos en un 30%. En foros como Reddit, los ingenieros debaten si es mejor optar por sistemas propietarios integrados o sensores de vibración genéricos acoplados a equipos existentes.`;

        rawCitations.push(
          { url: "https://www.forbes.com/sites/industry-iot-trends", title: "Tendencias de IoT Industrial - Forbes" },
          { url: "https://reddit.com/r/engineering/comments/iot_sensors", title: "Sensores IoT en Ingeniería - Reddit" },
          { url: compUrls[0] || "https://competitor.com", title: "Equipamiento de Monitoreo Remoto" }
        );
      } else {
        answer = `La sostenibilidad y la descarbonización son los principales impulsores del desarrollo en esta categoría. **${this.targetCompany}** ha lanzado recientemente una nueva línea de productos con un 10% menos de emisiones de CO2 equivalente.

Este avance ha sido cubierto en varios medios de tecnología industrial, señalando que la optimización de procesos de aire comprimido representa una de las formas más rápidas y baratas para que las plantas reduzcan su consumo de electricidad total.`;

        rawCitations.push(
          { url: targetUrl + "/sustainability-report", title: "Reporte de Sostenibilidad de " + this.targetCompany },
          { url: "https://wikipedia.org/wiki/Sustainability_in_engineering", title: "Sostenibilidad en Ingeniería - Wikipedia" }
        );
      }
    }

    return {
      answer,
      citations: normalizeCitations(rawCitations),
      provider: this.name,
      raw: { simulated: true }
    };
  }
}
