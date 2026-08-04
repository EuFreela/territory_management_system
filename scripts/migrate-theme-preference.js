/**
 * Preferência de tema (light/dark) por usuário.
 * Uso: node scripts/migrate-theme-preference.js
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
  if (await columnExists('users', 'theme_preference')) {
    console.log('users.theme_preference already exists');
  } else {
    await conn.execute(`
      ALTER TABLE users
      ADD COLUMN theme_preference VARCHAR(10) NOT NULL DEFAULT 'light'
      COMMENT 'light | dark — preferência individual do usuário'
      AFTER password_hash
    `);
    console.log('Added users.theme_preference (default light)');
  }
} finally {
  await conn.end();
}
