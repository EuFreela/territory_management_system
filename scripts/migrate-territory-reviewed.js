/**
 * Coluna is_reviewed em territories (revisado e aprovado).
 * Uso: node scripts/migrate-territory-reviewed.js
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
  if (await columnExists('territories', 'is_reviewed')) {
    console.log('territories.is_reviewed already exists');
  } else {
    await conn.execute(`
      ALTER TABLE territories
      ADD COLUMN is_reviewed TINYINT(1) NOT NULL DEFAULT 0
      COMMENT 'Território revisado e aprovado'
      AFTER daily_assignment_id
    `);
    console.log('Added territories.is_reviewed');
  }

  if (await columnExists('territories', 'reviewed_at')) {
    console.log('territories.reviewed_at already exists');
  } else {
    await conn.execute(`
      ALTER TABLE territories
      ADD COLUMN reviewed_at DATETIME NULL
      COMMENT 'Quando foi marcado como revisado/aprovado'
      AFTER is_reviewed
    `);
    console.log('Added territories.reviewed_at');
  }
} finally {
  await conn.end();
}
