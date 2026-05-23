const { syncNews } = require('./sync');
const { pool } = require('./db');

async function run() {
  console.log("⏰ [CRON JOB] Iniciando actualización diaria de noticias...");
  try {
    const start = Date.now();
    const stats = await syncNews();
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    
    console.log(`\n🎉 [CRON JOB] ¡Actualización diaria completada de forma exitosa en ${duration} segundos!`);
    console.log(`----------------------------------------`);
    console.log(`📊 Noticias Evaluadas:  ${stats.evaluated}`);
    console.log(`✨ Nuevas Ingestadas:    ${stats.inserted}`);
    console.log(` Omitidas (Duplicados): ${stats.skipped}`);
    console.log(`----------------------------------------`);
  } catch (err) {
    console.error("🚨 [CRON JOB] Error crítico en la actualización automática:", err);
    process.exitCode = 1;
  } finally {
    // Cerrar de forma limpia las conexiones activas a la base de datos de Neon
    await pool.end();
    console.log("🔌 Conexiones de base de datos cerradas. El script se va a dormir. ¡Hasta mañana!");
  }
}

run();
