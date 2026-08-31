/**
 * Bloqueio de usuário.
 * - users.blocked TINYINT(1) NOT NULL DEFAULT 0: 1 = usuário bloqueado (não consegue logar)
 * Uso: node scripts/migrate-user-blocked.js
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
  if (await columnExists('users', 'blocked')) {
    console.log('users.blocked already exists');
  } else {
    await conn.execute(`
      ALTER TABLE users
      ADD COLUMN blocked TINYINT(1) NOT NULL DEFAULT 0
      COMMENT '1 = usuário bloqueado (não pode entrar)'
    `);
    console.log('Added users.blocked');
  }
  console.log('migrate-user-blocked: ok');
} finally {
  await conn.end();
}
