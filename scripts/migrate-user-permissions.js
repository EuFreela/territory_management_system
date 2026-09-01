/**
 * Permissões exclusivas por usuário (além das do papel).
 * Cada usuário pode ganhar escopos adicionais em users_permissions.
 * Uso: node scripts/migrate-user-permissions.js
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

async function tableExists(table) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table],
  );
  return Number(rows[0]?.c) > 0;
}

try {
  if (await tableExists('user_permissions')) {
    console.log('user_permissions already exists');
  } else {
    await conn.execute(`
      CREATE TABLE user_permissions (
        user_id INT NOT NULL,
        permission VARCHAR(80) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, permission),
        CONSTRAINT fk_user_permissions_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('Created table user_permissions');
  }
  console.log('migrate-user-permissions: ok');
} finally {
  await conn.end();
}
