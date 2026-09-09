/**
 * Permissão "Gerir escala de dirigentes" (schedule:manage).
 * Concede o escopo aos papéis de sistema admin e editor; papéis personalizados
 * recebem a permissão pela página Permissões.
 * Uso: node scripts/migrate-schedule-manage.js
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const SCOPE = 'schedule:manage';
const SLUGS = ['admin', 'editor'];

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'campo',
});

try {
  let granted = 0;
  for (const slug of SLUGS) {
    const [rows] = await conn.execute('SELECT id FROM roles WHERE slug = ?', [slug]);
    if (!rows[0]) {
      console.log(`role ${slug} not found — skip`);
      continue;
    }
    const [res] = await conn.execute(
      'INSERT IGNORE INTO role_permissions (role_id, permission) VALUES (?, ?)',
      [rows[0].id, SCOPE],
    );
    if (res.affectedRows > 0) {
      granted += 1;
      console.log(`granted ${SCOPE} to role ${slug}`);
    } else {
      console.log(`role ${slug} already has ${SCOPE}`);
    }
  }
  console.log(`migrate-schedule-manage: ok (${granted} granted)`);
} finally {
  await conn.end();
}