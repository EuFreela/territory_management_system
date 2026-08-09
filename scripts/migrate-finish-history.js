/**
 * Histórico de territórios finalizados.
 * Uso: node scripts/migrate-finish-history.js
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

async function tableExists(conn, table) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table],
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

async function columnExists(conn, table, column) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return Number(rows[0]?.c) > 0;
}

try {
  if (await tableExists(conn, 'territory_finish_history')) {
    console.log('territory_finish_history already exists');
  } else {
    await conn.execute(`
      CREATE TABLE territory_finish_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        territory_id INT NULL,
        territory_name VARCHAR(120) NOT NULL,
        territory_number VARCHAR(50) NULL,
        field_date DATE NOT NULL,
        field_time VARCHAR(40) NULL,
        leader_name VARCHAR(255) NULL,
        people_count INT NULL,
        finished_by_user_id INT NULL,
        finished_by_name VARCHAR(150) NULL,
        finished_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_territory_day (territory_id, field_date),
        INDEX idx_field_date (field_date),
        CONSTRAINT fk_finish_territory
          FOREIGN KEY (territory_id) REFERENCES territories(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('created territory_finish_history');
  }

  if (!(await columnExists(conn, 'territory_finish_history', 'people_count'))) {
    await conn.execute(
      'ALTER TABLE territory_finish_history ADD COLUMN people_count INT NULL AFTER leader_name',
    );
    console.log('added people_count');
  } else {
    console.log('people_count already exists');
  }

  if (!(await columnExists(conn, 'territory_finish_history', 'finished_by_user_id'))) {
    await conn.execute(
      'ALTER TABLE territory_finish_history ADD COLUMN finished_by_user_id INT NULL AFTER people_count',
    );
    console.log('added finished_by_user_id');
  } else {
    console.log('finished_by_user_id already exists');
  }

  if (!(await columnExists(conn, 'territory_finish_history', 'finished_by_name'))) {
    await conn.execute(
      'ALTER TABLE territory_finish_history ADD COLUMN finished_by_name VARCHAR(150) NULL AFTER finished_by_user_id',
    );
    console.log('added finished_by_name');
  } else {
    console.log('finished_by_name already exists');
  }

  if (!(await columnExists(conn, 'territory_finish_history', 'quadras_count'))) {
    await conn.execute(
      'ALTER TABLE territory_finish_history ADD COLUMN quadras_count INT NULL AFTER people_count',
    );
    console.log('added quadras_count');
  } else {
    console.log('quadras_count already exists');
  }

  if (!(await columnExists(conn, 'territory_finish_history', 'ruas_count'))) {
    await conn.execute(
      'ALTER TABLE territory_finish_history ADD COLUMN ruas_count INT NULL AFTER quadras_count',
    );
    console.log('added ruas_count');
  } else {
    console.log('ruas_count already exists');
  }

  if (!(await columnExists(conn, 'territory_finish_history', 'casas_count'))) {
    await conn.execute(
      'ALTER TABLE territory_finish_history ADD COLUMN casas_count INT NULL AFTER ruas_count',
    );
    console.log('added casas_count');
  } else {
    console.log('casas_count already exists');
  }

  if (!(await columnExists(conn, 'territory_finish_history', 'restam_casas'))) {
    await conn.execute(
      'ALTER TABLE territory_finish_history ADD COLUMN restam_casas INT NULL AFTER casas_count',
    );
    console.log('added restam_casas');
  } else {
    console.log('restam_casas already exists');
  }

  // Histórico cumulativo: várias finalizações do mesmo território no mesmo dia
  try {
    const [fks] = await conn.execute(
      `SELECT CONSTRAINT_NAME
       FROM information_schema.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'territory_finish_history'
         AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
    );
    for (const row of fks) {
      try {
        await conn.execute(
          `ALTER TABLE territory_finish_history DROP FOREIGN KEY \`${row.CONSTRAINT_NAME}\``,
        );
        console.log('dropped FK', row.CONSTRAINT_NAME);
      } catch {
        /* ignore */
      }
    }
    try {
      await conn.execute('ALTER TABLE territory_finish_history DROP INDEX uq_territory_day');
      console.log('dropped unique uq_territory_day (histórico cumulativo)');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/check that it exists|Can't DROP|Unknown key/i.test(msg)) {
        console.log('uq_territory_day already absent');
      } else {
        console.log('drop uq_territory_day:', msg.slice(0, 100));
      }
    }
    try {
      await conn.execute(
        'CREATE INDEX idx_territory_id ON territory_finish_history (territory_id)',
      );
      console.log('created idx_territory_id');
    } catch {
      console.log('idx_territory_id ok/exists');
    }
    try {
      await conn.execute(
        `ALTER TABLE territory_finish_history
         ADD CONSTRAINT fk_finish_territory
         FOREIGN KEY (territory_id) REFERENCES territories(id) ON DELETE SET NULL`,
      );
      console.log('re-added fk_finish_territory');
    } catch {
      console.log('fk_finish_territory ok/exists');
    }
  } catch (e) {
    console.log('history unique cleanup:', e.message?.slice?.(0, 120) || e);
  }

  console.log('OK');
} finally {
  await conn.end();
}
