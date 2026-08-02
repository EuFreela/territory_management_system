import 'dotenv/config';
import mysql from 'mysql2/promise';

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [process.env.DB_NAME || 'campo', table, column],
  );
  return Number(rows[0]?.c) > 0;
}

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'campo',
});

try {
  if (!(await columnExists(conn, 'territories', 'cep'))) {
    await conn.execute('ALTER TABLE territories ADD COLUMN cep VARCHAR(9) NULL AFTER number');
    console.log('added cep');
  } else {
    console.log('cep already exists');
  }

  if (!(await columnExists(conn, 'territories', 'map_lat'))) {
    await conn.execute('ALTER TABLE territories ADD COLUMN map_lat DECIMAL(10,7) NULL AFTER geojson');
    console.log('added map_lat');
  } else {
    console.log('map_lat already exists');
  }

  if (!(await columnExists(conn, 'territories', 'map_lng'))) {
    await conn.execute('ALTER TABLE territories ADD COLUMN map_lng DECIMAL(10,7) NULL AFTER map_lat');
    console.log('added map_lng');
  } else {
    console.log('map_lng already exists');
  }
} finally {
  await conn.end();
}
