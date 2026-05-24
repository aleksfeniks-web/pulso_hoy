const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initTables() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS news (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        source TEXT NOT NULL,
        source_url TEXT,
        excerpt TEXT NOT NULL,
        body TEXT NOT NULL,
        truth_score INT DEFAULT 85,
        truth_label TEXT DEFAULT 'Verificado',
        truth_factors TEXT[],
        is_financial BOOLEAN DEFAULT false,
        chart_data JSONB,
        image_url TEXT,
        user_email TEXT,
        status TEXT DEFAULT 'published',
        local_location TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS subscribers (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        plan TEXT DEFAULT 'gratis',
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS likes (
        id SERIAL PRIMARY KEY,
        news_id INT REFERENCES news(id) ON DELETE CASCADE,
        user_token TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(news_id, user_token)
      );
      
      CREATE TABLE IF NOT EXISTS read_later (
        id SERIAL PRIMARY KEY,
        news_id INT REFERENCES news(id) ON DELETE CASCADE,
        user_token TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(news_id, user_token)
      );
      
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        news_id INT REFERENCES news(id) ON DELETE CASCADE,
        author_name TEXT NOT NULL,
        comment_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // Migración segura: agregar columna local_location si no existe en base de datos ya creada
    try {
      await client.query("ALTER TABLE news ADD COLUMN IF NOT EXISTS local_location TEXT");
      console.log('✅ Columna local_location verificada/agregada');
    } catch (migErr) {
      console.warn('⚠️ Advertencia en migración de columna local_location:', migErr.message);
    }
    
    console.log('✅ Tablas listas');
  } catch (err) {
    console.error('❌ Error en tablas', err);
  } finally {
    client.release();
  }
}

async function queryWithAuth(jwt, text, params) {
  if (!jwt) {
    return pool.query(text, params);
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Verificar si la función de Neon Authorize (auth.jwt_session_init) está disponible en la base de datos
    try {
      await client.query('SELECT auth.jwt_session_init($1)', [jwt]);
    } catch (authErr) {
      // Si la función no existe (ej. RLS/Neon Authorize no configurado), ignoramos y continuamos
      console.warn("⚠️ Neon Authorize (auth.jwt_session_init) no configurado o inactivo en la base de datos. Usando consulta sin políticas RLS.");
    }
    
    const res = await client.query(text, params);
    await client.query('COMMIT');
    return res;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, initTables, queryWithAuth };
