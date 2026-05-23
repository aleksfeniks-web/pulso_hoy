const { pool } = require('./db');

const sampleNews = [
  {
    title: "OpenAI lanza GPT-5 con razonamiento lógico avanzado y memoria extendida",
    category: "tecnologia",
    source: "OpenAI Tech Blog",
    source_url: "https://openai.com",
    excerpt: "La nueva inteligencia artificial revoluciona la comprensión conceptual y procesamiento de datos complejos en tiempo real.",
    body: "El sector tecnológico experimenta una de sus mayores revoluciones con la presentación de GPT-5. OpenAI ha anunciado de manera oficial el lanzamiento de su modelo más potente de procesamiento de lenguaje natural y razonamiento lógico. Este nuevo sistema incorpora una arquitectura avanzada de razonamiento conceptual por capas, memoria de largo plazo optimizada y procesamiento nativo de entradas multimedia concurrentes.\n\nLas pruebas de rendimiento demuestran que GPT-5 supera a sus predecesores y competidores en áreas complejas como resolución de problemas matemáticos, escritura de código de software integrado y comprensión de sutilezas culturales. Además, se integra de forma directa con APIs financieras y bases de datos transaccionales.",
    truth_score: 96,
    truth_label: "Verificado",
    truth_factors: ["Respaldado por anuncios oficiales de OpenAI", "Pruebas de referencia de terceros", "Demostraciones de video en vivo"],
    is_financial: false,
    chart_data: null,
    image_url: null,
    user_email: "editor@uniconews.com"
  },
  {
    title: "Banco de México mantiene tasa de interés de referencia ante inflación persistente",
    category: "economia",
    source: "Banco de México (Banxico)",
    source_url: "https://www.banxico.org.mx",
    excerpt: "La junta de gobierno decide conservar la tasa en 11.00% tras evaluar las presiones inflacionarias globales.",
    body: "En una decisión unánime, la Junta de Gobierno del Banco de México decidió mantener la tasa de interés de referencia en un 11.00% anual. Esta medida busca consolidar la trayectoria de la inflación hacia su meta de largo plazo del 3.0%, en un entorno macroeconómico que continúa reportando presiones en los precios de servicios clave y volatilidad cambiaria en los mercados globales.\n\nAnalistas sugieren que las tasas de interés se mantendrán elevadas por el resto del año para garantizar estabilidad macroeconómica y mitigar presiones en el sector de alimentos y bebidas no alcohólicas.",
    truth_score: 98,
    truth_label: "Verificado",
    truth_factors: ["Comunicado de prensa oficial de Banxico", "Minutas de la junta de gobierno", "Datos del INEGI"],
    is_financial: true,
    chart_data: {
      labels: ["Dic", "Ene", "Feb", "Mar", "Abr", "May"],
      values: [11.25, 11.25, 11.25, 11.00, 11.00, 11.00],
      title: "Tasa de Referencia Banxico",
      unit: "%",
      type: "line"
    },
    image_url: null,
    user_email: "economia@uniconews.com"
  },
  {
    title: "Europa acelera planes de transición energética ante olas de calor extremas",
    category: "mundo",
    source: "Reuters Europa",
    source_url: "https://reuters.com",
    excerpt: "La Comisión Europea propone recortar subsidios a combustibles fósiles y duplicar presupuesto para energías limpias.",
    body: "El Parlamento Europeo ha aprobado una serie de reformas de emergencia energética para mitigar los efectos del cambio climático y asegurar un suministro eléctrico resiliente. Ante las inusuales olas de calor que azotan al sur del continente, los estados miembros acordaron redirigir fondos hacia infraestructura eólica marina e instalaciones solares residenciales.\n\nSe prevé que las medidas aceleren la neutralidad de carbono planificada para el año 2050 e incrementen la soberanía energética regional.",
    truth_score: 88,
    truth_label: "Probable",
    truth_factors: ["Borradores del parlamento aprobados", "Registros climáticos de Copernicus", "Presupuestos asignados preliminares"],
    is_financial: false,
    chart_data: null,
    image_url: null,
    user_email: "planeta@uniconews.com"
  },
  {
    title: "Tesla anuncia su próximo coche autónomo de bajo costo para mercados masivos",
    category: "tecnologia",
    source: "TechCrunch",
    source_url: "https://techcrunch.com",
    excerpt: "La automotriz prevé iniciar producción el próximo año con una nueva plataforma de manufactura modular.",
    body: "Elon Musk presentó el diseño conceptual del nuevo automóvil eléctrico compacto y autónomo de Tesla, diseñado específicamente para democratizar la movilidad eléctrica. Con un precio estimado inicial por debajo de los $25,000 USD, este coche implementará la última versión de conducción autónoma total supervisada (FSD V12).\n\nInversores recibieron con optimismo la noticia tras el ajuste en las proyecciones de entregas trimestrales y la optimización de los costos de gigafactorías en Asia y América del Norte.",
    truth_score: 78,
    truth_label: "Probable",
    truth_factors: ["Declaraciones públicas de Elon Musk", "Presentación en el día de inversionistas", "Patentes de manufactura registradas"],
    is_financial: false,
    chart_data: null,
    image_url: null,
    user_email: "editor@uniconews.com"
  },
  {
    title: "Brote de dengue en América Latina activa alertas epidemiológicas nacionales",
    category: "salud",
    source: "Organización Panamericana de la Salud (OPS)",
    source_url: "https://www.paho.org",
    excerpt: "El aumento inusual de temperaturas y lluvias impulsa la propagación del mosquito transmisor en zonas urbanas.",
    body: "La Organización Panamericana de la Salud ha emitido una alerta urgente a los gobiernos de la región para intensificar las campañas de fumigación y control de vectores. Con más de un millón de casos sospechosos registrados en lo que va del año, los hospitales del sector público refuerzan sus áreas de atención clínica.\n\nSe recomienda a la ciudadanía eliminar contenedores de agua estancada y usar repelente de mosquitos regularmente para contener la transmisión comunitaria.",
    truth_score: 92,
    truth_label: "Verificado",
    truth_factors: ["Boletines oficiales de la OPS", "Informes ministeriales de salud de Brasil, México y Colombia", "Monitoreo del clima satelital"],
    is_financial: false,
    chart_data: null,
    image_url: null,
    user_email: "salud@uniconews.com"
  },
  {
    title: "El peso mexicano registra volatilidad y presiones frente al dólar arancelario",
    category: "economia",
    source: "El Economista",
    source_url: "https://www.eleconomista.com.mx",
    excerpt: "El tipo de cambio fluctúa ante las negociaciones comerciales y anuncios de aranceles industriales internacionales.",
    body: "La paridad peso-dólar mostró fluctuaciones importantes a lo largo de la semana. Los inversores reaccionaron con cautela ante los pronunciamientos sobre políticas comerciales arancelarias bilaterales. Aunque las remesas familiares actúan como un soporte sólido para el consumo interno, el mercado financiero permanece atento al diferencial de tasas entre la Reserva Federal y Banxico.\n\nAnalistas financieros estiman estabilidad relativa a mediano plazo, pero sugieren coberturas cambiarias ante la incertidumbre electoral en socios comerciales.",
    truth_score: 94,
    truth_label: "Verificado",
    truth_factors: ["Cotizaciones interbancarias en tiempo real", "Declaraciones de la Secretaría de Economía", "Reportes cambiarios del Banco de México"],
    is_financial: true,
    chart_data: {
      labels: ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6"],
      values: [16.80, 17.10, 16.95, 17.40, 17.25, 17.65],
      title: "Tipo de Cambio USD/MXN",
      unit: "Pesos",
      type: "line"
    },
    image_url: null,
    user_email: "economia@uniconews.com"
  },
  {
    title: "Congreso debate reformas estructurales al sistema de pensiones y jubilación",
    category: "politica",
    source: "Gaceta Parlamentaria",
    source_url: "https://www.diputados.gob.mx",
    excerpt: "La propuesta busca incrementar la aportación patronal obligatoria para garantizar pensiones dignas.",
    body: "La Cámara de Diputados abrió el debate legislativo en torno a la reforma previsional. Entre los puntos más álgidos se encuentra la creación de un fondo de pensiones solidario sustentado con recursos gubernamentales y excedentes operativos de organismos descentralizados. Los partidos políticos debaten la sustentabilidad fiscal del proyecto a mediano plazo.\n\nEl sector empresarial ha expresado reservas y solicita mesas de negociación tripartita antes de someter el dictamen a votación en el pleno.",
    truth_score: 85,
    truth_label: "Probable",
    truth_factors: ["Minutas públicas del congreso", "Borrador de dictamen legislativo publicado", "Pronunciamientos de cámaras empresariales"],
    is_financial: false,
    chart_data: null,
    image_url: null,
    user_email: "politica@uniconews.com"
  },
  {
    title: "Empresas tecnológicas reportan ingresos récord gracias a la adopción corporativa de IA",
    category: "business",
    source: "Wall Street Journal",
    source_url: "https://wsj.com",
    excerpt: "Microsoft y Google superan estimaciones de Wall Street con crecimientos de doble dígito en la nube híbrida.",
    body: "El último trimestre fiscal demostró que la inversión empresarial en inteligencia artificial no es solo una tendencia pasajera, sino un motor de crecimiento sostenido. Las plataformas de computación en la nube híbrida e infraestructura de modelos a gran escala han reportado un incremento sin precedentes en su cartera de clientes corporativos.\n\nLos analistas coinciden en que los presupuestos corporativos se están optimizando drásticamente, priorizando el ahorro en infraestructura física para reasignarlo al desarrollo de modelos internos predictivos y flujos automatizados.",
    truth_score: 91,
    truth_label: "Verificado",
    truth_factors: ["Informes de ganancias públicas obligatorios (SEC)", "Llamadas de inversionistas grabadas", "Valorizaciones bursátiles trimestrales"],
    is_financial: false,
    chart_data: null,
    image_url: null,
    user_email: "business@uniconews.com"
  },
  {
    title: "Nuevas rutas comerciales del Ártico abren debates geopolíticos globales",
    category: "mundo",
    source: "Foreign Affairs",
    source_url: "https://foreignaffairs.com",
    excerpt: "El deshielo polar acelera el tránsito marítimo pero incrementa la tensión de soberanía fronteriza.",
    body: "El aumento del tránsito de barcos cargueros a través del Paso del Noroeste ha captado la atención de las principales potencias comerciales mundiales. Países limítrofes como Canadá, Rusia y Estados Unidos incrementan sus patrullajes de seguridad aérea y marítima para delimitar zonas de exclusión económica exclusiva.\n\nExpertos advierten que el ahorro en tiempos de flete y costos de combustible (hasta un 40% menor comparado con el Canal de Suez) apresurará a las corporaciones logísticas a forzar la apertura de rutas comerciales a pesar de las disputas de soberanía ambiental.",
    truth_score: 82,
    truth_label: "Probable",
    truth_factors: ["Datos de tránsito satelital militar", "Reportes de la Organización Marítima Internacional", "Tratados polares vigentes"],
    is_financial: false,
    chart_data: null,
    image_url: null,
    user_email: "planeta@uniconews.com"
  }
];

async function seed() {
  console.log("🌱 Iniciando sembrado de noticias en Neon PostgreSQL...");
  const client = await pool.connect();
  
  try {
    // 1. Limpiar noticias anteriores para evitar redundancias
    await client.query("DELETE FROM likes");
    await client.query("DELETE FROM read_later");
    await client.query("DELETE FROM news");
    console.log("🧹 Base de datos de noticias limpiada.");
    
    // 2. Insertar noticias de ejemplo
    for (const item of sampleNews) {
      await client.query(`
        INSERT INTO news (title, category, source, source_url, excerpt, body, truth_score, truth_label, truth_factors, is_financial, chart_data, image_url, user_email, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'published')
      `, [
        item.title,
        item.category,
        item.source,
        item.source_url,
        item.excerpt,
        item.body,
        item.truth_score,
        item.truth_label,
        item.truth_factors,
        item.is_financial,
        item.chart_data ? JSON.stringify(item.chart_data) : null,
        item.image_url,
        item.user_email
      ]);
      console.log(`✨ Noticia insertada: "${item.title}"`);
    }
    
    console.log("🚀 ¡Sembrado completado de manera exitosa! La base de datos de Neon cuenta ahora con 9 noticias premium.");
  } catch (err) {
    console.error("❌ Error durante el sembrado:", err);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
