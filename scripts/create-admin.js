/**
 * Cria o primeiro usuário administrador com senha aleatória forte.
 * Uso: node scripts/create-admin.js
 *
 * A senha é impressa UMA única vez no terminal — salve-a antes de fechar.
 * Opcional via .env: ADMIN_NAME, ADMIN_EMAIL (padrão: admin@campo.local).
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';

const BCRYPT_ROUNDS = 12;
const DEFAULT_EMAIL = 'admin@campo.local';

function randomPassword(length = 18) {
  const pools = {
    lower: 'abcdefghijkmnpqrstuvwxyz',
    upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
    digits: '23456789',
    special: '!@#$%&*+-=?_',
  };
  const all = Object.values(pools).join('');
  const rand = (n) => Math.floor((crypto.randomBytes(4).readUInt32BE(0) / 2 ** 32) * n);

  // Garante ao menos 1 caractere de cada classe exigida pela política de senha
  const chars = Object.values(pools).map((pool) => pool[rand(pool.length)]);
  while (chars.length < length) chars.push(all[rand(all.length)]);

  // Embaralha para não deixar os "garantidos" no início
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'campo',
  });

  try {
    const [roleRows] = await conn.execute(
      "SELECT id FROM roles WHERE slug = 'admin' LIMIT 1",
    );
    const roleId = roleRows[0]?.id;
    if (!roleId) {
      console.error('Papel "admin" não encontrado. Rode primeiro: npm run migrate:rbac');
      process.exit(1);
    }

    const email = (process.env.ADMIN_EMAIL || DEFAULT_EMAIL).toLowerCase();

    if (!process.argv.includes('--force')) {
      const [existing] = await conn.execute(
        `SELECT u.id FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
         WHERE u.email = ? OR r.slug = 'admin'
         LIMIT 1`,
        [email],
      );
      if (existing[0]) {
        console.error(
          'Já existe um administrador no banco. Nada foi alterado (use --force para criar outro).',
        );
        process.exit(1);
      }
    }

    const password = randomPassword();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const name = process.env.ADMIN_NAME || 'Administrador';

    await conn.execute(
      'INSERT INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, roleId],
    );

    console.log('');
    console.log('Administrador criado:');
    console.log(`  Email : ${email}`);
    console.log(`  Nome  : ${name}`);
    console.log(`  Senha : ${password}`);
    console.log('');
    console.log('ATENÇÃO: guarde a senha AGORA. Ela só é exibida esta vez.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
