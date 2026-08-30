/**
 * Migração RBAC: roles, role_permissions, users.role_id + seeds.
 * Uso: node scripts/migrate-rbac.js
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const SCOPES = [
  'territory:create',
  'territory:read',
  'territory:update',
  'territory:delete',
  'territory:set_daily',
  'block:manage',
  'block:check',
  'user:manage',
  'config:cep',
  'congregation:manage',
];

const ROLES = [
  {
    slug: 'admin',
    name: 'Administrador',
    description: 'Acesso total ao sistema',
    permissions: SCOPES,
  },
  {
    slug: 'editor',
    name: 'Editor',
    description: 'Cria e edita territórios e não em casa; sem excluir nem gerir usuários',
    permissions: [
      'territory:create',
      'territory:read',
      'territory:update',
      'territory:set_daily',
      'block:manage',
      'block:check',
    ],
  },
  {
    slug: 'field',
    name: 'Campo',
    description: 'Consulta territórios e marca os números visitados no não em casa',
    permissions: ['territory:read', 'block:check'],
  },
  {
    slug: 'viewer',
    name: 'Visualizador',
    description: 'Somente leitura de territórios',
    permissions: ['territory:read'],
  },
];

async function columnExists(conn, table, column) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return Number(rows[0]?.c) > 0;
}

async function tableExists(conn, table) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table],
  );
  return Number(rows[0]?.c) > 0;
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
    if (!(await tableExists(conn, 'roles'))) {
      await conn.execute(`
        CREATE TABLE roles (
          id INT AUTO_INCREMENT PRIMARY KEY,
          slug VARCHAR(50) NOT NULL UNIQUE,
          name VARCHAR(100) NOT NULL,
          description VARCHAR(255) NULL,
          is_system TINYINT(1) DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('created table roles');
    } else {
      console.log('roles already exists');
    }

    if (!(await tableExists(conn, 'role_permissions'))) {
      await conn.execute(`
        CREATE TABLE role_permissions (
          role_id INT NOT NULL,
          permission VARCHAR(80) NOT NULL,
          PRIMARY KEY (role_id, permission),
          CONSTRAINT fk_role_permissions_role
            FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('created table role_permissions');
    } else {
      console.log('role_permissions already exists');
    }

    if (!(await columnExists(conn, 'users', 'role_id'))) {
      await conn.execute('ALTER TABLE users ADD COLUMN role_id INT NULL AFTER password_hash');
      console.log('added users.role_id');
    } else {
      console.log('users.role_id already exists');
    }

    // FK se ainda não existir
    try {
      await conn.execute(`
        ALTER TABLE users
        ADD CONSTRAINT fk_users_role
          FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
      `);
      console.log('added fk_users_role');
    } catch (e) {
      if (!/Duplicate|exists/i.test(String(e.message))) {
        // pode já existir
        console.log('fk_users_role:', e.message?.slice?.(0, 80) || e);
      } else {
        console.log('fk_users_role already exists');
      }
    }

    // Seed roles + permissions
    for (const role of ROLES) {
      const [existing] = await conn.execute('SELECT id FROM roles WHERE slug = ?', [role.slug]);
      let roleId = existing[0]?.id;
      if (!roleId) {
        const [ins] = await conn.execute(
          'INSERT INTO roles (slug, name, description, is_system) VALUES (?, ?, ?, 1)',
          [role.slug, role.name, role.description],
        );
        roleId = ins.insertId;
        console.log('seeded role', role.slug, roleId);
      } else {
        await conn.execute('UPDATE roles SET name = ?, description = ? WHERE id = ?', [
          role.name,
          role.description,
          roleId,
        ]);
        console.log('updated role', role.slug, roleId);
      }

      await conn.execute('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);
      for (const perm of role.permissions) {
        await conn.execute(
          'INSERT INTO role_permissions (role_id, permission) VALUES (?, ?)',
          [roleId, perm],
        );
      }
      console.log('  permissions:', role.permissions.length);
    }

    // Atribui admin ao usuário admin@campo.local (ou o primeiro usuário)
    const [adminRoleRows] = await conn.execute('SELECT id FROM roles WHERE slug = ?', ['admin']);
    const adminRoleId = adminRoleRows[0]?.id;
    if (adminRoleId) {
      const [adminUsers] = await conn.execute(
        "SELECT id FROM users WHERE email = 'admin@campo.local' LIMIT 1",
      );
      if (adminUsers[0]) {
        await conn.execute('UPDATE users SET role_id = ? WHERE id = ?', [
          adminRoleId,
          adminUsers[0].id,
        ]);
        console.log('assigned admin role to admin@campo.local');
      }

      // Usuários sem role → field
      const [fieldRoleRows] = await conn.execute('SELECT id FROM roles WHERE slug = ?', ['field']);
      const fieldRoleId = fieldRoleRows[0]?.id;
      if (fieldRoleId) {
        const [r] = await conn.execute(
          'UPDATE users SET role_id = ? WHERE role_id IS NULL AND email <> ?',
          [fieldRoleId, 'admin@campo.local'],
        );
        console.log('default field role for users without role:', r.affectedRows ?? 0);
      }

      // Se admin@ não existia mas há usuários sem role, não força admin
    }

    console.log('RBAC migration OK');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
