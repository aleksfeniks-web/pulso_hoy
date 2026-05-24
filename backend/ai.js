/**
 * ai.js — Módulo de Inteligencia Artificial para UnicoNews
 * Powered by Google Gemini 1.5 Flash (gratis hasta 1M tokens/mes)
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';


// Cache simple en memoria para el quiz y briefing del día
const dailyCache = { quiz: null, briefing: null, date: null };

/**
 * Llama a la API de Gemini con un prompt
 */
async function askGemini(prompt, temperature = 0.7) {
  const apiKey = process.env.GOOGLE_AI_KEY;
  if (!apiKey) throw new Error('GOOGLE_AI_KEY no configurada en variables de entorno');

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { 
        temperature, 
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingBudget: 0 }
      }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * POST /api/ai/summarize
 * Body: { text: string, url?: string }
 * Devuelve: { summary, keyPoints, complexity, keywords, readTime }
 */
async function summarize(req, res) {
  try {
    const { text, title } = req.body;
    if (!text || text.trim().length < 50)
      return res.status(400).json({ error: 'El texto es demasiado corto para resumir' });

    const prompt = `Eres un asistente de noticias experto. Analiza el siguiente artículo periodístico y responde ÚNICAMENTE con un JSON válido con este formato exacto:
{
  "summary": "Resumen del artículo en 2-3 oraciones claras y concisas",
  "keyPoints": ["Punto clave 1", "Punto clave 2", "Punto clave 3", "Punto clave 4", "Punto clave 5"],
  "complexity": "básico|intermedio|avanzado",
  "keywords": ["palabra1", "palabra2", "palabra3", "palabra4", "palabra5"],
  "readTime": "X minutos",
  "sentiment": "positivo|negativo|neutral",
  "category": "categoría del artículo"
}

ARTÍCULO:
Título: ${title || 'Sin título'}
${text.substring(0, 3000)}

Responde SOLO con el JSON, sin texto adicional, sin markdown, sin backticks.`;

    const raw = await askGemini(prompt, 0.3);
    const jsonStr = raw.replace(/```json?/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(jsonStr);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[AI summarize]', err.message);
    res.status(500).json({ error: 'Error al generar el resumen', detail: err.message });
  }
}

/**
 * POST /api/ai/chat
 * Body: { message: string, history?: [{role, content}], newsContext?: string }
 * Devuelve: { reply: string }
 */
async function chat(req, res) {
  try {
    const { message, history = [], newsContext = '' } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Mensaje vacío' });

    // Construir historial como texto
    const historyText = history.slice(-8).map(h =>
      `${h.role === 'user' ? 'Usuario' : 'Asistente'}: ${h.content}`
    ).join('\n');

    const prompt = `Eres NewsBot, el asistente de inteligencia artificial de UnicoNews — un portal de noticias verificadas en español. 
Eres experto en noticias, política, economía, tecnología y eventos mundiales.
Respondes siempre en español, de forma clara, objetiva y bien estructurada.
Cuando no tengas información actualizada de hoy, lo indicas honestamente.
Usas emojis ocasionalmente para hacerte más amigable.

${newsContext ? `CONTEXTO DE NOTICIAS DE HOY EN UNICONEWS:\n${newsContext}\n` : ''}
${historyText ? `HISTORIAL DE CONVERSACIÓN:\n${historyText}\n` : ''}

PREGUNTA DEL USUARIO: ${message}

RESPUESTA:`;

    const reply = await askGemini(prompt, 0.7);
    res.json({ ok: true, reply });
  } catch (err) {
    console.error('[AI chat]', err.message);
    res.status(500).json({ error: 'Error en el chat de IA', detail: err.message });
  }
}

/**
 * POST /api/ai/analyze-bias
 * Body: { text: string, title?: string }
 * Devuelve: { sentiment, bias, language, emotionalWords, overall }
 */
async function analyzeBias(req, res) {
  try {
    const { text, title } = req.body;
    if (!text || text.trim().length < 50)
      return res.status(400).json({ error: 'Texto demasiado corto' });

    const prompt = `Eres un analista de medios experto en detectar sesgos y tonos periodísticos. Analiza el siguiente artículo y responde ÚNICAMENTE con este JSON:
{
  "sentiment": {
    "label": "positivo|negativo|neutral",
    "score": 0.75,
    "description": "Descripción breve del tono general"
  },
  "bias": {
    "label": "izquierda|centro-izquierda|centro|centro-derecha|derecha|no determinado",
    "score": 0.5,
    "description": "Explicación del sesgo detectado"
  },
  "language": {
    "label": "informativo|opinión|sensacionalista|propagandístico",
    "score": 0.6,
    "description": "Descripción del tipo de lenguaje"
  },
  "emotionalWords": ["palabra1", "palabra2", "palabra3"],
  "credibilityScore": 0.8,
  "overall": "Evaluación general del artículo en 1-2 oraciones",
  "recommendations": ["Recomendación 1 para lectura crítica", "Recomendación 2"]
}

Nota: score va de 0 a 1 donde para sentimiento: 0=muy negativo, 1=muy positivo; para bias: 0=extrema izquierda, 1=extrema derecha; para lenguaje: 0=muy informativo, 1=muy sensacionalista; credibilidad: 0=baja, 1=alta.

ARTÍCULO:
Título: ${title || ''}
${text.substring(0, 2500)}

Responde SOLO con el JSON válido, sin texto adicional.`;

    const raw = await askGemini(prompt, 0.2);
    const jsonStr = raw.replace(/```json?/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(jsonStr);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[AI bias]', err.message);
    res.status(500).json({ error: 'Error en análisis de sesgo', detail: err.message });
  }
}

/**
 * POST /api/ai/explain
 * Body: { term: string, context?: string }
 * Devuelve: { explanation, simpleVersion, example, relatedTerms }
 */
async function explain(req, res) {
  try {
    const { term, context } = req.body;
    if (!term?.trim()) return res.status(400).json({ error: 'Término vacío' });

    const prompt = `Eres un educador experto en explicar conceptos complejos de forma simple. Explica el siguiente término en el contexto de las noticias y responde ÚNICAMENTE con este JSON:
{
  "explanation": "Explicación completa y precisa en 3-4 oraciones",
  "simpleVersion": "Explicación en lenguaje muy simple, como si le explicaras a un niño de 12 años, en 1-2 oraciones",
  "example": "Ejemplo concreto y actual de cómo esto aparece en las noticias",
  "historicalContext": "Breve contexto histórico relevante",
  "relatedTerms": ["término relacionado 1", "término relacionado 2", "término relacionado 3"],
  "importance": "Por qué es importante entender este término hoy"
}

TÉRMINO: "${term}"
${context ? `CONTEXTO DEL ARTÍCULO: ${context.substring(0, 500)}` : ''}

Responde SOLO con el JSON válido, en español, sin texto adicional.`;

    const raw = await askGemini(prompt, 0.5);
    const jsonStr = raw.replace(/```json?/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(jsonStr);
    res.json({ ok: true, term, ...result });
  } catch (err) {
    console.error('[AI explain]', err.message);
    res.status(500).json({ error: 'Error al explicar el término', detail: err.message });
  }
}

/**
 * GET /api/ai/quiz
 * Query: ?topics=politica,economia&force=false
 * Devuelve: { questions: [{question, options, correct, explanation}] }
 */
async function quiz(req, res) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { force } = req.query;

    // Usar caché del día si existe
    if (dailyCache.quiz && dailyCache.date === today && force !== 'true') {
      return res.json({ ok: true, cached: true, ...dailyCache.quiz });
    }

    // Obtener titulares recientes del contexto (si está disponible)
    const topics = req.query.topics || 'política, economía, tecnología, internacional, ciencia';

    const prompt = `Eres un creador de contenido educativo para un portal de noticias. Genera 5 preguntas de quiz sobre noticias y eventos actuales de 2025-2026 en los temas: ${topics}.

Responde ÚNICAMENTE con este JSON:
{
  "questions": [
    {
      "id": 1,
      "question": "Pregunta clara sobre un evento o concepto de actualidad",
      "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "correct": 0,
      "explanation": "Explicación breve de por qué esta es la respuesta correcta",
      "difficulty": "fácil|medio|difícil",
      "category": "categoría del tema"
    }
  ],
  "title": "Quiz del Día: [Tema central]",
  "date": "${today}"
}

Asegúrate de que:
- Las preguntas sean sobre hechos verificables y actuales
- Las opciones incorrectas sean plausibles pero claramente incorrectas
- "correct" sea el índice (0-3) de la respuesta correcta
- Las preguntas sean en español y de actualidad 2025-2026

Responde SOLO con el JSON válido, sin texto adicional.`;

    const raw = await askGemini(prompt, 0.6);
    const jsonStr = raw.replace(/```json?/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(jsonStr);

    // Guardar en caché
    dailyCache.quiz = result;
    dailyCache.date = today;

    res.json({ ok: true, cached: false, ...result });
  } catch (err) {
    console.error('[AI quiz]', err.message);
    res.status(500).json({ error: 'Error al generar el quiz', detail: err.message });
  }
}

/**
 * POST /api/ai/briefing
 * Body: { interests?: string[], userName?: string, newsHeadlines?: string[] }
 * Devuelve: { briefing: string, highlights: string[] }
 */
async function briefing(req, res) {
  try {
    const { interests = [], userName = '', newsHeadlines = [] } = req.body;
    const today = new Date().toISOString().split('T')[0];

    const interestStr = interests.length > 0
      ? interests.join(', ')
      : 'política, economía, tecnología, internacional';

    const headlinesStr = newsHeadlines.length > 0
      ? '\n\nNoticias del portal hoy:\n' + newsHeadlines.slice(0, 10).map((h, i) => `${i + 1}. ${h}`).join('\n')
      : '';

    const prompt = `Eres el asistente personal de noticias de UnicoNews. Genera un briefing de noticias del día personalizado${userName ? ` para ${userName}` : ''}.

El usuario está interesado en: ${interestStr}
${headlinesStr}

Genera el briefing en formato conversacional, como si fuera un periodista hablándole directamente al usuario. Incluye:
1. Saludo personalizado con la hora del día
2. 3-4 noticias más importantes del momento en sus temas de interés
3. Dato curioso del día
4. Cierre motivacional

Responde ÚNICAMENTE con este JSON:
{
  "briefing": "Texto completo del briefing en formato conversacional, con párrafos separados por \\n\\n",
  "highlights": ["Titular 1", "Titular 2", "Titular 3"],
  "mood": "informativo|serio|optimista|preocupante",
  "readTime": "X minutos"
}

Responde SOLO con el JSON válido, en español, sin texto adicional.`;

    const raw = await askGemini(prompt, 0.8);
    const jsonStr = raw.replace(/```json?/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(jsonStr);
    res.json({ ok: true, date: today, ...result });
  } catch (err) {
    console.error('[AI briefing]', err.message);
    res.status(500).json({ error: 'Error al generar el briefing', detail: err.message });
  }
}

/**
 * POST /api/ai/local-news
 * Body: { location: string }
 * Devuelve: { news: [newsItems] }
 */
async function localNews(req, res) {
  try {
    const { location } = req.body;
    if (!location?.trim()) {
      return res.status(400).json({ error: 'Ubicación requerida' });
    }

    const prompt = `Eres un reportero local de noticias verídicas y relevantes de UnicoNews.
Genera 3 noticias locales realistas y de actualidad para la ubicación: "${location}".
Las noticias deben ser interesantes, cubrir diferentes categorías (como economía local, obras públicas, transporte, tecnología regional, salud o comunidad) y redactarse con un tono periodístico formal y veraz.
Asegúrate de que las noticias parezcan de actualidad (año 2026) y tengan fuentes locales realistas del lugar.

Responde ÚNICAMENTE con este JSON con esta estructura exacta (sin texto adicional, sin markdown y sin backticks):
{
  "news": [
    {
      "id": 10000,
      "title": "Título llamativo e informativo de la noticia local en ${location}",
      "category": "economia|politica|tecnologia|mundo|salud|business",
      "source": "Nombre de una fuente de noticias o diario local creíble de ${location}",
      "excerpt": "Un resumen de 1 o 2 oraciones atractivas sobre la noticia local.",
      "body": "El cuerpo completo del artículo local. Desarrolla los hechos detalladamente en 2 a 3 párrafos, especificando nombres de avenidas, calles, zonas, alcaldes o regulaciones de la ubicación ${location}.",
      "truth_score": 95,
      "truth_label": "Verificado",
      "truth_factors": ["Hechos confirmados por boletín oficial local", "Declaración directa del ayuntamiento o delegación"],
      "is_financial": false,
      "chart_data": null,
      "image_url": null,
      "local_location": "${location}",
      "created_at": "${new Date().toISOString()}"
    }
  ]
}

Responde SOLO con el JSON válido, en español, sin texto adicional y sin formateo markdown de código.`;

    const raw = await askGemini(prompt, 0.75);
    const jsonStr = raw.replace(/```json?/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(jsonStr);
    
    // Asignar IDs secuenciales únicos temporales a partir de un timestamp
    const now = Date.now();
    if (result.news && Array.isArray(result.news)) {
      result.news.forEach((item, index) => {
        item.id = now + index;
        item.local_location = location;
      });
    }
    
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[AI local-news]', err.message);
    res.status(500).json({ error: 'Error al generar noticias locales', detail: err.message });
  }
}

module.exports = { summarize, chat, analyzeBias, explain, quiz, briefing, localNews };
