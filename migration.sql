CREATE DATABASE IF NOT EXISTS campo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE campo;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- "NÃO EM CASA": número da quadra, rua e casas sem resposta
CREATE TABLE blocks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  territory_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,                 -- Número da quadra (ex: 1, 2, A)
  street_name VARCHAR(180) NULL,              -- Nome da rua
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

-- Dirigentes do serviço de campo (designações por data ou dia fixo)
CREATE TABLE IF NOT EXISTS field_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  service_date DATE NULL,
  weekday_label VARCHAR(40) NOT NULL,
  assignee_name VARCHAR(180) NOT NULL,
  period_label VARCHAR(80) NULL,
  is_fixed TINYINT(1) DEFAULT 0,
  fixed_weekday TINYINT NULL,              -- 0=Dom … 6=Sáb (JS)
  fixed_time VARCHAR(10) NULL,              -- ex: 08:00
  sort_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_service_date (service_date),
  INDEX idx_fixed_weekday (fixed_weekday)
) ENGINE=InnoDB;

-- Senha padrão do admin: 123456 (mínimo 6 caracteres exigido pela API)
INSERT INTO users (name, email, password_hash)
VALUES ('Administrador', 'admin@campo.local', '$2b$10$KpSm9ser0EX5usgs2.1em.TpfvROSW8knZpTPosW2/VD8moPOG.Uy')
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash);
