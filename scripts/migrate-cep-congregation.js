/**
 * Nome da congregação por CEP (tabela cep_regions).
 * Uso: node scripts/migrate-cep-congregation.js
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'campo',
});

async function tableExists(table) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table],
  );
  return Number(rows[0]?.c) > 0;
}

try {
  if (await tableExists('cep_regions')) {
    console.log('cep_regions already exists');
  } else {
    await conn.execute(`
      CREATE TABLE cep_regions (
        cep VARCHAR(9) NOT NULL,
        name VARCHAR(120) NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (cep)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('Created table cep_regions');
  }
  console.log('migrate-cep-congregation: ok');
} finally {
  await conn.end();
}
