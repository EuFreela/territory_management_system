/**
 * Região de trabalho por CEP.
 * - users.active_cep: CEP da região do usuário (null = usa TERRITORY_CEP do .env)
 * - field_assignments.cep / territory_finish_history.cep: vínculo à região
 * Uso: node scripts/migrate-active-cep.js
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

function formatCep(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length !== 8) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

async function columnExists(table, column) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return Number(rows[0]?.c) > 0;
}

async function indexExists(table, indexName) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName],
  );
  return Number(rows[0]?.c) > 0;
}

const defaultCep = formatCep(process.env.TERRITORY_CEP || '37940-000');
if (String(defaultCep).replace(/\D/g, '').length !== 8) {
  console.error('TERRITORY_CEP inválido no .env (use 8 dígitos).');
  process.exit(1);
}

try {
  if (await columnExists('users', 'active_cep')) {
    console.log('users.active_cep already exists');
  } else {
    const afterCol = (await columnExists('users', 'theme_preference'))
      ? 'theme_preference'
      : 'password_hash';
    await conn.execute(`
      ALTER TABLE users
      ADD COLUMN active_cep VARCHAR(9) NULL
      COMMENT 'CEP da região de trabalho (null = TERRITORY_CEP do .env)'
      AFTER ${afterCol}
    `);
    console.log('Added users.active_cep');
  }

  if (await columnExists('field_assignments', 'cep')) {
    console.log('field_assignments.cep already exists');
  } else {
    await conn.execute(`
      ALTER TABLE field_assignments
      ADD COLUMN cep VARCHAR(9) NULL
      COMMENT 'CEP da região (congregação) desta designação'
      AFTER sort_order
    `);
    console.log('Added field_assignments.cep');
  }

  if (await columnExists('territory_finish_history', 'cep')) {
    console.log('territory_finish_history.cep already exists');
  } else {
    await conn.execute(`
      ALTER TABLE territory_finish_history
      ADD COLUMN cep VARCHAR(9) NULL
      COMMENT 'CEP da região no momento da finalização'
      AFTER territory_number
    `);
    console.log('Added territory_finish_history.cep');
  }

  const [usersUpdated] = await conn.execute(
    `UPDATE users SET active_cep = ? WHERE active_cep IS NULL OR TRIM(active_cep) = ''`,
    [defaultCep],
  );
  console.log(`Backfilled users.active_cep → ${defaultCep} (${usersUpdated.affectedRows ?? 0} rows)`);

  const [faUpdated] = await conn.execute(
    `UPDATE field_assignments SET cep = ? WHERE cep IS NULL OR TRIM(cep) = ''`,
    [defaultCep],
  );
  console.log(
    `Backfilled field_assignments.cep → ${defaultCep} (${faUpdated.affectedRows ?? 0} rows)`,
  );

  if (await columnExists('territories', 'cep')) {
    const [tUpdated] = await conn.execute(
      `UPDATE territories SET cep = ? WHERE cep IS NULL OR TRIM(cep) = ''`,
      [defaultCep],
    );
    console.log(`Backfilled territories.cep → ${defaultCep} (${tUpdated.affectedRows ?? 0} rows)`);
  }

  if (await columnExists('territory_finish_history', 'cep')) {
    const [hUpdated] = await conn.execute(
      `UPDATE territory_finish_history h
       LEFT JOIN territories t ON t.id = h.territory_id
       SET h.cep = COALESCE(NULLIF(TRIM(t.cep), ''), ?)
       WHERE h.cep IS NULL OR TRIM(h.cep) = ''`,
      [defaultCep],
    );
    console.log(
      `Backfilled territory_finish_history.cep (${hUpdated.affectedRows ?? 0} rows)`,
    );
  }

  if (await columnExists('territories', 'cep') && !(await indexExists('territories', 'idx_territories_cep'))) {
    await conn.execute('ALTER TABLE territories ADD INDEX idx_territories_cep (cep)');
    console.log('Added index territories.idx_territories_cep');
  }

  if (
    (await columnExists('field_assignments', 'cep')) &&
    !(await indexExists('field_assignments', 'idx_field_assignments_cep'))
  ) {
    await conn.execute('ALTER TABLE field_assignments ADD INDEX idx_field_assignments_cep (cep)');
    console.log('Added index field_assignments.idx_field_assignments_cep');
  }

  console.log('migrate-active-cep: ok');
} finally {
  await conn.end();
}
