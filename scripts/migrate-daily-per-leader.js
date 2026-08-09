/**
 * Território do dia por dirigente:
 * coluna daily_assignment_id em territories (um território do dia por dirigente).
 * Uso: node scripts/migrate-daily-per-leader.js
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
  if (await columnExists('territories', 'daily_assignment_id')) {
    console.log('territories.daily_assignment_id already exists');
  } else {
    await conn.execute(`
      ALTER TABLE territories
      ADD COLUMN daily_assignment_id INT NULL
      COMMENT 'Território do dia vinculado a um dirigente (field_assignments.id)',
      ADD CONSTRAINT fk_territories_daily_assignment
        FOREIGN KEY (daily_assignment_id) REFERENCES field_assignments(id) ON DELETE SET NULL
    `);
    console.log('Added territories.daily_assignment_id + FK');
  }
} finally {
  await conn.end();
}
