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
    `);
    console.log('✅ Tablas listas');
  } catch (err) {
    console.error('❌ Error en tablas', err);
  } finally {
    client.release();
  }
}

module.exports = { pool, initTables };
