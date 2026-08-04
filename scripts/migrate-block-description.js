/**
 * Coluna description em blocks (nota informativa por rua).
 * Uso: node scripts/migrate-block-description.js
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

async function columnExists(table, column) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return Number(rows[0]?.c) > 0;
}

try {
  if (await columnExists('blocks', 'description')) {
    console.log('blocks.description already exists');
  } else {
    await conn.execute(`
      ALTER TABLE blocks
      ADD COLUMN description VARCHAR(500) NULL
      COMMENT 'Nota informativa da rua (só exibição)'
      AFTER street_name
    `);
    console.log('Added blocks.description');
  }
} finally {
  await conn.end();
}
