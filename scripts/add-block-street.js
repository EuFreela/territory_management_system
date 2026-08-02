import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'campo',
});

try {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'blocks' AND COLUMN_NAME = 'street_name'`,
    [process.env.DB_NAME || 'campo'],
  );
  const exists = Number(rows[0]?.c) > 0;
  if (!exists) {
    await conn.execute(
      'ALTER TABLE blocks ADD COLUMN street_name VARCHAR(180) NULL AFTER name',
    );
    console.log('added blocks.street_name');
  } else {
    console.log('street_name already exists');
  }
} finally {
  await conn.end();
}
