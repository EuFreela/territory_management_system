import 'dotenv/config';
import mysql from 'mysql2/promise';

/**
 * Tabela + seed: Dirigentes do Serviço de Campo
 * Datas no formato M/D/YYYY (como na planilha original)
 */

const dated = {
  'Quarta-feira': [
    ['2026-07-08', 'Lameck'],
    ['2026-07-15', 'Marcelo'],
    ['2026-07-22', 'Fábio'],
    ['2026-07-29', 'Marcelo'],
    ['2026-08-05', 'Lameck'],
    ['2026-08-12', 'Fábio'],
    ['2026-08-19', 'Marcelo'],
    ['2026-08-26', 'Sérgio'],
    ['2026-09-02', 'Lameck'],
    ['2026-09-09', 'Sérgio'],
    ['2026-09-16', 'Fábio'],
  ],
  'Sexta-feira': [
    ['2026-07-10', 'Fábio'],
    ['2026-07-17', 'Lameck'],
    ['2026-07-24', 'Marcelo'],
    ['2026-07-31', 'Sérgio'],
    ['2026-08-07', 'Mauro'],
    ['2026-08-14', 'Lameck'],
    ['2026-08-21', 'Fábio'],
    ['2026-08-28', 'Marcelo'],
    ['2026-09-04', 'Lameck'],
    ['2026-09-11', 'Mauro'],
  ],
  Sábado: [
    ['2026-07-04', 'Fabiano'],
    ['2026-07-11', 'Novaldo'],
    ['2026-07-18', 'Sérgio'],
    ['2026-07-25', 'Ronaldo'],
    ['2026-08-01', 'Tiago'],
    ['2026-08-08', 'Novaldo'],
    ['2026-08-15', 'Fabiano'],
    ['2026-08-22', 'Ronaldo'],
    ['2026-08-29', 'Sérgio'],
  ],
  Domingo: [
    ['2026-07-05', 'Grupo 2 do Ronaldo'],
    ['2026-07-12', 'Grupo 3 do Sidnei'],
    ['2026-07-19', 'Grupo 1 do Fernando'],
    ['2026-07-26', 'Grupo 2 do Ronaldo'],
    ['2026-08-02', 'Grupo 3 do Sidnei'],
    ['2026-08-09', 'Grupo 1 do Fernando'],
    ['2026-08-16', 'Grupo 2 do Ronaldo'],
    ['2026-08-23', 'Grupo 3 do Sidnei'],
    ['2026-08-30', 'Grupo 1 do Fernando'],
  ],
};

// JS: 0=Dom … 6=Sáb
const fixed = [
  { weekday: 2, label: 'Terça-feira', time: '08:00', name: 'Tiago' },
  { weekday: 3, label: 'Quarta-feira', time: '08:00', name: 'Sidnei' },
  { weekday: 4, label: 'Quinta-feira', time: '08:00', name: 'Érlon' },
];

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'campo',
  multipleStatements: true,
});

try {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS field_assignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      service_date DATE NULL,
      weekday_label VARCHAR(40) NOT NULL,
      assignee_name VARCHAR(180) NOT NULL,
      period_label VARCHAR(80) NULL,
      is_fixed TINYINT(1) DEFAULT 0,
      fixed_weekday TINYINT NULL,
      fixed_time VARCHAR(10) NULL,
      sort_order INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_service_date (service_date),
      INDEX idx_fixed_weekday (fixed_weekday)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  const [countRows] = await conn.query('SELECT COUNT(*) AS c FROM field_assignments');
  const count = Number(countRows[0]?.c ?? 0);

  if (count > 0) {
    console.log(`field_assignments already has ${count} rows — skip seed (use --force to reseed)`);
    if (!process.argv.includes('--force')) {
      await conn.end();
      process.exit(0);
    }
    await conn.query('DELETE FROM field_assignments');
    console.log('cleared field_assignments');
  }

  const period = 'Julho / Agosto';
  let sort = 0;

  for (const [weekdayLabel, rows] of Object.entries(dated)) {
    for (const [date, name] of rows) {
      await conn.execute(
        `INSERT INTO field_assignments
          (service_date, weekday_label, assignee_name, period_label, is_fixed, fixed_weekday, fixed_time, sort_order)
         VALUES (?, ?, ?, ?, 0, NULL, NULL, ?)`,
        [date, weekdayLabel, name, period, sort++],
      );
    }
  }

  for (const item of fixed) {
    await conn.execute(
      `INSERT INTO field_assignments
        (service_date, weekday_label, assignee_name, period_label, is_fixed, fixed_weekday, fixed_time, sort_order)
       VALUES (NULL, ?, ?, ?, 1, ?, ?, ?)`,
      [item.label, item.name, 'Dias fixos', item.weekday, item.time, sort++],
    );
  }

  const [after] = await conn.query('SELECT COUNT(*) AS c FROM field_assignments');
  console.log(`seeded ${after[0].c} field_assignments`);
} finally {
  await conn.end();
}
