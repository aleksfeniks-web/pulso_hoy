const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { pool, initTables, queryWithAuth } = require('./db');
const { syncNews } = require('./sync');
const ai = require('./ai');
const { Resend } = require('resend'); // Importación de la librería de correos Resend
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Sirve el frontend

initTables();

// Inicialización segura del cliente Resend
const resend = process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_tu_clave_de_resend_aqui'
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

if (!resend) {
  console.warn("⚠️ Advertencia: RESEND_API_KEY no configurada. El servicio de envío de boletines estará inactivo en modo de desarrollo.");
}

// ========== API RUTAS ==========

// Configuración pública (Clerk Publishable Key)
app.get('/api/config', (req, res) => {
  res.json({
    clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || null
  });
});

// Obtener todas las noticias publicadas (con Left Join para obtener foto del escritor)
app.get('/api/news', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT n.id, n.title, n.category, n.source, n.source_url, n.excerpt, n.body, 
             n.truth_score, n.truth_label, n.truth_factors, n.is_financial, 
             n.chart_data, n.image_url, n.local_location, n.is_original, n.created_at, n.user_email,
             s.name as writer_name, s.profile_pic as writer_profile_pic
      FROM news n
      LEFT JOIN subscribers s ON n.user_email = s.email
      WHERE n.status = 'published' 
      ORDER BY n.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener noticias' });
  }
});

// Obtener una noticia por ID (con Left Join para obtener foto del escritor)
app.get('/api/news/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT n.*, s.name as writer_name, s.profile_pic as writer_profile_pic
      FROM news n
      LEFT JOIN subscribers s ON n.user_email = s.email
      WHERE n.id = $1 AND n.status = 'published'
    `, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener noticia detallada' });
  }
});

// Sincronizar noticias del feed RSS (Cron Job endpoint)
app.post('/api/cron/sync-news', async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret) {
    const clientSecret = req.headers['x-cron-secret'] || req.query.secret;
    if (clientSecret !== cronSecret) {
      return res.status(401).json({ error: 'No autorizado. Secreto incorrecto.' });
    }
  } else {
    console.warn("⚠️ Advertencia: CRON_SECRET no configurado en el archivo .env del servidor. El endpoint de sincronización está desprotegido en modo desarrollo.");
  }
  
  try {
    const stats = await syncNews();
    res.json({ success: true, stats });
  } catch (err) {
    console.error("Error en sincronización automática:", err);
    res.status(500).json({ error: 'Error al sincronizar noticias del feed' });
  }
});

// Publicar nueva noticia (desde el frontend)
app.post('/api/news', async (req, res) => {
  const { title, category, source, source_url, excerpt, body, is_financial, chart_data, image_url, user_email, local_location, is_original } = req.body;
  if (!title || !category || !source || !excerpt || !body) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  try {
    const result = await queryWithAuth(token, `
      INSERT INTO news (title, category, source, source_url, excerpt, body, is_financial, chart_data, image_url, user_email, status, local_location, is_original)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'published', $11, $12)
      RETURNING *
    `, [title, category, source, source_url, excerpt, body, is_financial || false, chart_data || null, image_url || null, user_email || null, local_location || null, is_original || false]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar noticia' });
  }
});

// Suscripción
app.post('/api/subscribe', async (req, res) => {
  const { email, name, plan } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido' });
  try {
    // 1. Guardar en la base de datos de Neon
    await pool.query(`
      INSERT INTO subscribers (email, name, plan) VALUES ($1, $2, $3)
      ON CONFLICT (email) DO UPDATE SET plan = EXCLUDED.plan, name = EXCLUDED.name
    `, [email, name || null, plan || 'gratis']);
    
    // 2. Enviar correo electrónico mediante la API de Resend (si está configurada con una API Key válida)
    if (resend) {
      try {
        await resend.emails.send({
          from: 'UnicoNews <onboarding@resend.dev>', // Dominio Sandbox por defecto de Resend
          to: email,
          subject: '📰 ¡Bienvenido a UnicoNews! Tu suscripción al boletín está lista',
          html: `
            <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="font-family: 'Playfair Display', Georgia, serif; font-size: 2.2rem; color: #ef446f; margin: 0; font-weight: 800; letter-spacing: -0.5px;">UnicoNews</h1>
                <p style="font-size: 0.88rem; color: #64748b; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; margin-top: 4px;">Portal de Noticias Verificadas</p>
              </div>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 24px;" />
              <h2 style="font-size: 1.35rem; color: #0f172a; margin-top: 0; font-weight: 700;">¡Hola, ${name || 'Lector Verificado'}! 👋</h2>
              <p style="font-size: 1rem; line-height: 1.7; color: #334155;">Te has suscrito exitosamente a nuestro boletín en el plan <strong>${(plan || 'gratis').toUpperCase()}</strong>.</p>
              <p style="font-size: 1rem; line-height: 1.7; color: #334155;">A partir de ahora, recibirás de forma periódica las últimas noticias del día, rigurosamente analizadas por nuestra inteligencia artificial para entregarte solo la información más veraz y contrastada, libre de sesgos mediáticos.</p>
              
              <div style="background-color: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px; padding: 20px; margin: 28px 0; text-align: center;">
                <span style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: #3b82f6; display: block; margin-bottom: 6px; letter-spacing: 1px;">Estado de tu cuenta</span>
                <span style="font-size: 1.25rem; font-weight: 800; color: #0f172a; display: block;">Plan ${(plan || 'gratis').toUpperCase()} Activo ✅</span>
              </div>
              
              <p style="font-size: 1rem; line-height: 1.7; color: #334155;">¡Gracias por confiar en la transparencia informativa de UnicoNews!</p>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 28px 0;" />
              <div style="text-align: center; font-size: 0.75rem; color: #94a3b8; line-height: 1.5;">
                <p style="margin: 0 0 4px 0;">Este es un correo automático de bienvenida.</p>
                <p style="margin: 0;">© 2026 UnicoNews Corporation. Todos los derechos reservados.</p>
              </div>
            </div>
          `
        });
        console.log(`✉️ Correo de bienvenida enviado con éxito vía Resend a: ${email}`);
      } catch (mailErr) {
        console.error("⚠️ Error al despachar correo en Resend:", mailErr.message);
      }
    } else {
      console.warn("⚠️ Envío omitido: Cliente Resend inactivo (API Key no configurada o usa placeholder).");
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en suscripción' });
  }
});

// Verificar suscripción por email
app.post('/api/subscribe/verify', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido' });
  try {
    const result = await pool.query('SELECT * FROM subscribers WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email no registrado como suscriptor' });
    }
    res.json({ success: true, subscriber: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al verificar suscripción' });
  }
});

// Cargar/Actualizar foto de perfil del redactor
app.post('/api/writer/profile-pic', async (req, res) => {
  const { email, profile_pic_base64 } = req.body;
  if (!email || !profile_pic_base64) {
    return res.status(400).json({ error: 'Faltan email o imagen' });
  }

  try {
    const matches = profile_pic_base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Formato de imagen inválido' });
    }

    const ext = matches[1].split('/')[1] || 'png';
    const buffer = Buffer.from(matches[2], 'base64');
    
    const profileDir = path.join(__dirname, 'public', 'uploads', 'profile');
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }

    const filename = `profile_${Buffer.from(email).toString('hex').slice(0, 16)}.${ext}`;
    const filePath = path.join(profileDir, filename);
    
    fs.writeFileSync(filePath, buffer);
    const dbPath = `/uploads/profile/${filename}`;

    const result = await pool.query(`
      UPDATE subscribers
      SET profile_pic = $1
      WHERE email = $2
      RETURNING *
    `, [dbPath, email]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Suscriptor no encontrado' });
    }

    console.log(`👤 Foto de perfil cargada físicamente para ${email} en ${dbPath}`);
    res.json({ success: true, profile_pic: dbPath, subscriber: result.rows[0] });

  } catch (err) {
    console.error('❌ Error al guardar foto de perfil:', err.message);
    res.status(500).json({ error: 'Error interno del servidor al procesar imagen de perfil' });
  }
});

// Panel de control (Dashboard) del redactor
app.get('/api/writer/:email/dashboard', async (req, res) => {
  const { email } = req.params;
  try {
    const subRes = await pool.query('SELECT * FROM subscribers WHERE email = $1', [email]);
    if (subRes.rows.length === 0) {
      return res.status(404).json({ error: 'Redactor no registrado' });
    }
    const subscriber = subRes.rows[0];

    const newsRes = await pool.query(`
      SELECT n.id, n.title, n.category, n.is_original, n.created_at, n.status,
             (SELECT COUNT(*) FROM likes WHERE news_id = n.id) as likes_count
      FROM news n
      WHERE n.user_email = $1
      ORDER BY n.created_at DESC
    `, [email]);
    
    const newsList = newsRes.rows;

    const newsCount = newsList.length;
    let totalLikes = 0;
    let originalCount = 0;
    
    newsList.forEach(item => {
      totalLikes += parseInt(item.likes_count) || 0;
      if (item.is_original) {
        originalCount++;
      }
    });

    res.json({
      success: true,
      subscriber,
      stats: {
        news_count: newsCount,
        original_count: originalCount,
        total_likes: totalLikes
      },
      news: newsList
    });

  } catch (err) {
    console.error('❌ Error al obtener dashboard del redactor:', err);
    res.status(500).json({ error: 'Error al cargar panel del redactor' });
  }
});

// Dar like (usuario anónimo con token)
app.post('/api/like', async (req, res) => {
  const { news_id, user_token } = req.body;
  if (!news_id || !user_token) return res.status(400).json({ error: 'Faltan datos' });
  try {
    await pool.query(`
      INSERT INTO likes (news_id, user_token) VALUES ($1, $2)
      ON CONFLICT (news_id, user_token) DO NOTHING
    `, [news_id, user_token]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar like' });
  }
});

// Contar likes de una noticia
app.get('/api/likes/:news_id', async (req, res) => {
  const { news_id } = req.params;
  const result = await pool.query('SELECT COUNT(*) FROM likes WHERE news_id = $1', [news_id]);
  res.json({ count: parseInt(result.rows[0].count) });
});

// Guardar para después
app.post('/api/readlater', async (req, res) => {
  const { news_id, user_token } = req.body;
  if (!news_id || !user_token) return res.status(400).json({ error: 'Faltan datos' });

  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  try {
    await queryWithAuth(token, `
      INSERT INTO read_later (news_id, user_token) VALUES ($1, $2)
      ON CONFLICT (news_id, user_token) DO NOTHING
    `, [news_id, user_token]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar' });
  }
});

// Eliminar de guardar para después
app.post('/api/readlater/remove', async (req, res) => {
  const { news_id, user_token } = req.body;
  if (!news_id || !user_token) return res.status(400).json({ error: 'Faltan datos' });

  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  try {
    await queryWithAuth(token, `
      DELETE FROM read_later WHERE news_id = $1 AND user_token = $2
    `, [news_id, user_token]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al quitar' });
  }
});

// Obtener lista de "leer después"
app.get('/api/readlater/:user_token', async (req, res) => {
  const { user_token } = req.params;
  const result = await pool.query(`
    SELECT n.* FROM read_later rl JOIN news n ON rl.news_id = n.id
    WHERE rl.user_token = $1 AND n.status = 'published'
  `, [user_token]);
  res.json(result.rows);
});

// Obtener comentarios de una noticia
app.get('/api/comments/:news_id', async (req, res) => {
  const { news_id } = req.params;
  try {
    const result = await pool.query(
      'SELECT id, news_id, author_name, comment_text, created_at FROM comments WHERE news_id = $1 ORDER BY created_at ASC',
      [news_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener comentarios' });
  }
});

// Guardar un nuevo comentario
app.post('/api/comments', async (req, res) => {
  const { news_id, author_name, comment_text } = req.body;
  if (!news_id || !author_name || !comment_text) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO comments (news_id, author_name, comment_text) VALUES ($1, $2, $3) RETURNING *',
      [news_id, author_name.trim(), comment_text.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar comentario' });
  }
});

// ELIMINAR COMENTARIO (Superusuario)
app.delete('/api/comments/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM comments WHERE id = $1', [id]);
    res.json({ success: true, message: 'Comentario eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar comentario' });
  }
});

// ELIMINAR NOTICIA (Superusuario)
app.delete('/api/news/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM likes WHERE news_id = $1', [id]);
    await pool.query('DELETE FROM read_later WHERE news_id = $1', [id]);
    await pool.query('DELETE FROM comments WHERE news_id = $1', [id]);
    await pool.query('DELETE FROM news WHERE id = $1', [id]);
    res.json({ success: true, message: 'Noticia eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar noticia' });
  }
});

// EDITAR NOTICIA (Superusuario)
app.put('/api/news/:id', async (req, res) => {
  const { id } = req.params;
  const { title, category, source, excerpt, body, image_url, local_location } = req.body;
  
  if (!title || !category || !source || !excerpt || !body) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }
  
  let finalImageUrl = image_url;
  
  // Si la imagen es una carga local base64, la guardamos físicamente en disco
  if (image_url && image_url.startsWith('data:image/')) {
    try {
      const matches = image_url.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const ext = matches[1].split('/')[1] || 'png';
        const buffer = Buffer.from(matches[2], 'base64');
        
        const uploadsDir = path.join(__dirname, 'public', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        const filename = `news_${id}_${Date.now()}.${ext}`;
        fs.writeFileSync(path.join(uploadsDir, filename), buffer);
        finalImageUrl = `/uploads/${filename}`;
        console.log(`✅ Imagen base64 convertida y guardada físicamente como: ${finalImageUrl}`);
      }
    } catch (uploadErr) {
      console.error('⚠️ Error al guardar imagen base64 en disco:', uploadErr.message);
    }
  }
  
  try {
    const result = await pool.query(`
      UPDATE news
      SET title = $1, category = $2, source = $3, excerpt = $4, body = $5, image_url = $6, local_location = $7
      WHERE id = $8
      RETURNING *
    `, [title, category, source, excerpt, body, finalImageUrl || null, local_location || null, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Noticia no encontrada' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar noticia' });
  }
});

// Generar RSS feed
app.get('/rss.xml', async (req, res) => {
  const result = await pool.query(`
    SELECT title, excerpt, created_at, id FROM news WHERE status = 'published' ORDER BY created_at DESC LIMIT 20
  `);
  const items = result.rows.map(item => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <link>https://www.uniconews.com/noticia?id=${item.id}</link>
      <description>${escapeXml(item.excerpt)}</description>
      <pubDate>${new Date(item.created_at).toUTCString()}</pubDate>
      <guid>${item.id}</guid>
    </item>
  `).join('');
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <title>UnicoNews</title>
      <link>https://www.uniconews.com</link>
      <description>Noticias verificadas del día</description>
      ${items}
    </channel>
  </rss>`;
  res.header('Content-Type', 'application/rss+xml');
  res.send(rss);
});

function escapeXml(str) {
  return str.replace(/[<>&]/g, (m) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m]));
}

// ========== RUTAS DE INTELIGENCIA ARTIFICIAL ==========
// Powered by Google Gemini 1.5 Flash
app.post('/api/ai/summarize',      ai.summarize);
app.post('/api/ai/chat',           ai.chat);
app.post('/api/ai/analyze-bias',   ai.analyzeBias);
app.post('/api/ai/explain',        ai.explain);
app.get('/api/ai/quiz',            ai.quiz);
app.post('/api/ai/briefing',       ai.briefing);
app.post('/api/ai/local-news',     ai.localNews);

// Redirigir todo lo demás al index.html (para SPA) con soporte dinámico de Open Graph (SEO)
app.get('*', async (req, res) => {
  const id = req.query.id;
  const indexPath = path.join(__dirname, 'public', 'index.html');
  
  if (id && !isNaN(parseInt(id))) {
    try {
      // Intentar obtener la noticia de la base de datos
      const result = await pool.query('SELECT title, excerpt, image_url FROM news WHERE id = $1', [parseInt(id)]);
      if (result.rows.length > 0) {
        const article = result.rows[0];
        let html = fs.readFileSync(indexPath, 'utf8');
        
        // Generar meta tags de Open Graph específicos para la noticia
        const escapedTitle = escapeHtml(article.title);
        const escapedExcerpt = escapeHtml(article.excerpt);
        
        let imageUrl = article.image_url || 'https://uniconews.com/logo.jpg';
        if (imageUrl.startsWith('/')) {
          imageUrl = `https://uniconews.com${imageUrl}`;
        } else if (imageUrl.startsWith('data:')) {
          imageUrl = 'https://uniconews.com/logo.jpg';
        }
        
        const pageUrl = `https://uniconews.com/?id=${id}`;
        
        const ogTags = `
  <title>${escapedTitle} | UnicoNews 📰</title>
  <meta name="description" content="${escapedExcerpt}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:title" content="${escapedTitle}">
  <meta property="og:description" content="${escapedExcerpt}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:site_name" content="UnicoNews">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapedTitle}">
  <meta name="twitter:description" content="${escapedExcerpt}">
  <meta name="twitter:image" content="${imageUrl}">
        `;
        
        // Reemplazar el título y la descripción genéricos por los tags Open Graph específicos de forma robusta
        html = html.replace(/<title>[^<]*<\/title>/i, ogTags);
        html = html.replace(/<meta\s+name=["']description["']\s+content=["'][^"']*["']\s*\/?>/i, '');
        
        return res.send(html);
      }
    } catch (err) {
      console.error('⚠️ Error al generar metatags dinámicos de SEO:', err.message);
    }
  }
  
  // Fallback si no hay ID o si falla la base de datos
  res.sendFile(indexPath);
});

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
