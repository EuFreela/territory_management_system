/**
 * Login com Google (OAuth): permite users.password_hash NULL para contas
 * que entram apenas com Google.
 * Uso: node scripts/migrate-google-oauth.js
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

async function columnNullable(table, column) {
  const [rows] = await conn.execute(
    `SELECT IS_NULLABLE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return String(rows[0]?.IS_NULLABLE).toUpperCase() === 'YES';
}

try {
  if (await columnNullable('users', 'password_hash')) {
    console.log('users.password_hash already nullable');
  } else {
    await conn.execute('ALTER TABLE users MODIFY password_hash VARCHAR(255) NULL');
    console.log('users.password_hash is now nullable (Google-only accounts allowed)');
  }
} finally {
  await conn.end();
}
