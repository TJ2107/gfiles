-- Schema definition for Cloudflare D1 SQL Database

-- 1. Table for managing Users and authentication roles
CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'User', -- 'User' | 'Manager' | 'Admin'
  password TEXT NOT NULL, -- plaintext or hashed password for local auth
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table for tracking Preventive Maintenance (PM) and rescheduling logs
CREATE TABLE IF NOT EXISTS pm_assignments (
  id TEXT PRIMARY KEY,
  site_code TEXT,
  pm_number TEXT UNIQUE,
  site_name TEXT,
  region TEXT,
  planned_date TEXT,
  maintenance_type TEXT,
  technician_name TEXT,
  executed_date TEXT,
  reprogrammed_date TEXT,
  status TEXT DEFAULT 'Planifié', -- 'Planifié' | 'Exécuté' | 'Replanifié' | 'En retard'
  comments TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Table for storing daily raw data synchronized from Excel/Retable
CREATE TABLE IF NOT EXISTS daily_raw_data (
  id TEXT PRIMARY KEY,
  pm_number TEXT UNIQUE,
  site_code TEXT,
  site_name TEXT,
  region TEXT,
  planned_date TEXT,
  maintenance_type TEXT,
  technician_name TEXT,
  executed_date TEXT,
  reprogrammed_date TEXT,
  status TEXT,
  comments TEXT,
  imported_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Table for storing the complete full raw JSON data for the whole app
CREATE TABLE IF NOT EXISTS global_files (
  id TEXT PRIMARY KEY,
  swo_number TEXT,
  pm_number TEXT,
  raw_json TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Table for storing manual comments
CREATE TABLE IF NOT EXISTS manual_comments (
  id TEXT PRIMARY KEY,
  site_id TEXT,
  category TEXT,
  comment TEXT,
  updated_at INTEGER
);

-- Seed initial Admin User
INSERT OR IGNORE INTO users (uid, email, display_name, role, password)
VALUES (
  'admin-id',
  'cyber.kan587@gmail.com',
  'Administrateur',
  'Admin',
  'admin'
);

-- Seed some initial fallback PM assignments (Demo)
INSERT OR IGNORE INTO pm_assignments (id, site_code, pm_number, site_name, region, planned_date, maintenance_type, technician_name, status)
VALUES 
  ('row-01', 'SITE_DK_01', 'PM-2026-1001', 'Site Dakar Plateau', 'DAKAR', '2026-07-23', 'Trimestrielle', 'Ibrahima Ndiaye', 'Exécuté'),
  ('row-02', 'SITE_TH_02', 'PM-2026-1002', 'Site Thiès Gare', 'THIES', '2026-07-23', 'Semestrielle', 'Moustapha Diop', 'Planifié'),
  ('row-03', 'SITE_SL_03', 'PM-2026-1003', 'Site Saint-Louis Nord', 'SAINT-LOUIS', '2026-07-23', 'Annuelle', 'Amadou Sow', 'Replanifié'),
  ('row-04', 'SITE_ZG_04', 'PM-2026-1004', 'Site Ziguinchor Centre', 'ZIGUINCHOR', '2026-07-23', 'Mensuelle', 'Fatou Fall', 'En retard');
