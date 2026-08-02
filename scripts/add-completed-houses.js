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
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'blocks' AND COLUMN_NAME = 'completed_houses'`,
    [process.env.DB_NAME || 'campo'],
  );
  const exists = Number(rows[0]?.c) > 0;
  if (!exists) {
    await conn.execute(
      `ALTER TABLE blocks
       ADD COLUMN completed_houses JSON NULL AFTER house_numbers`,
    );
    await conn.execute(`UPDATE blocks SET completed_houses = JSON_ARRAY() WHERE completed_houses IS NULL`);
    console.log('added blocks.completed_houses');
  } else {
    console.log('completed_houses already exists');
  }
} finally {
  await conn.end();
}
