/**
 * Link da imagem do cartão em territories.image_url.
 * Uso: node scripts/migrate-territory-image-url.js
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
  if (await columnExists('territories', 'image_url')) {
    console.log('territories.image_url already exists');
  } else {
    const afterCol = (await columnExists('territories', 'number')) ? 'number' : 'name';
    await conn.execute(`
      ALTER TABLE territories
      ADD COLUMN image_url VARCHAR(2048) NULL
      COMMENT 'Link http(s) da imagem do cartão (não armazena o arquivo)'
      AFTER ${afterCol}
    `);
    console.log('Added territories.image_url');
  }
  console.log('migrate-territory-image-url: ok');
} finally {
  await conn.end();
}
