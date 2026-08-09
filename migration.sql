CREATE DATABASE IF NOT EXISTS campo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE campo;

CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  is_system TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE role_permissions (
  role_id INT NOT NULL,
  permission VARCHAR(80) NOT NULL,
  PRIMARY KEY (role_id, permission),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE territories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  number VARCHAR(50) NULL,
  cep VARCHAR(9) NULL,                       -- CEP do território (centraliza o mapa)
  geojson LONGTEXT NULL,
  map_lat DECIMAL(10,7) NULL,                -- latitude resolvida a partir do CEP
  map_lng DECIMAL(10,7) NULL,                -- longitude resolvida a partir do CEP
  is_daily TINYINT(1) DEFAULT 0,
  daily_assignment_id INT NULL,              -- território do dia vinculado a um dirigente (field_assignments.id)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (daily_assignment_id) REFERENCES field_assignments(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- "NÃO EM CASA": número da quadra, rua e casas sem resposta
CREATE TABLE blocks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  territory_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,                 -- Número da quadra (ex: 1, 2, A)
  street_name VARCHAR(180) NULL,              -- Nome da rua
  description VARCHAR(500) NULL,              -- Nota informativa (só exibição no card)
  house_numbers JSON NOT NULL,                -- Casas "não em casa": ["101","103"]
  completed_houses JSON NULL,                 -- Casas já trabalhadas no checklist
  sort_order INT DEFAULT 0,
  FOREIGN KEY (territory_id) REFERENCES territories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE territory_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  territory_id INT NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  caption VARCHAR(255) NULL,
  sort_order INT DEFAULT 0,
  FOREIGN KEY (territory_id) REFERENCES territories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Histórico de territórios finalizados (dia de campo + dirigente)
CREATE TABLE IF NOT EXISTS territory_finish_history (
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
  INDEX idx_field_date (field_date),
  INDEX idx_territory_id (territory_id),
  FOREIGN KEY (territory_id) REFERENCES territories(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Dirigentes do serviço de campo (designações por data ou dia fixo)
CREATE TABLE IF NOT EXISTS field_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  service_date DATE NULL,
  weekday_label VARCHAR(40) NOT NULL,
  assignee_name VARCHAR(180) NOT NULL,
  period_label VARCHAR(80) NULL,
  is_fixed TINYINT(1) DEFAULT 0,
  fixed_weekday TINYINT NULL,              -- 0=Dom … 6=Sáb (JS)
  fixed_time VARCHAR(40) NULL,             -- horário ou período (08:00, Manhã, Noite)
  sort_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_service_date (service_date),
  INDEX idx_fixed_weekday (fixed_weekday)
) ENGINE=InnoDB;

-- Papéis (RBAC)
INSERT INTO roles (slug, name, description, is_system) VALUES
  ('admin', 'Administrador', 'Acesso total ao sistema', 1),
  ('editor', 'Editor', 'Cria e edita territórios e não em casa', 1),
  ('field', 'Campo', 'Consulta, território do dia e checklist', 1),
  ('viewer', 'Visualizador', 'Somente leitura de territórios', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description);

-- Permissões do admin (todos os escopos)
INSERT IGNORE INTO role_permissions (role_id, permission)
SELECT r.id, p.permission FROM roles r
CROSS JOIN (
  SELECT 'territory:create' AS permission UNION ALL
  SELECT 'territory:read' UNION ALL
  SELECT 'territory:update' UNION ALL
  SELECT 'territory:delete' UNION ALL
  SELECT 'territory:set_daily' UNION ALL
  SELECT 'block:manage' UNION ALL
  SELECT 'user:manage'
) p
WHERE r.slug = 'admin';

INSERT IGNORE INTO role_permissions (role_id, permission)
SELECT r.id, p.permission FROM roles r
CROSS JOIN (
  SELECT 'territory:create' AS permission UNION ALL
  SELECT 'territory:read' UNION ALL
  SELECT 'territory:update' UNION ALL
  SELECT 'territory:set_daily' UNION ALL
  SELECT 'block:manage'
) p
WHERE r.slug = 'editor';

INSERT IGNORE INTO role_permissions (role_id, permission)
SELECT r.id, p.permission FROM roles r
CROSS JOIN (
  SELECT 'territory:read' AS permission UNION ALL
  SELECT 'territory:set_daily' UNION ALL
  SELECT 'block:manage'
) p
WHERE r.slug = 'field';

INSERT IGNORE INTO role_permissions (role_id, permission)
SELECT r.id, 'territory:read' FROM roles r WHERE r.slug = 'viewer';

-- Nenhum usuário é criado aqui (sem senha padrão conhecida).
-- Após aplicar o schema, crie o administrador com senha aleatória forte:
--   npm run create:admin
