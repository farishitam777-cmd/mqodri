import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "mastering.db");

// Ensure database file exists
const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma("foreign_keys = ON");

export function initDB() {
  console.log("Initializing SQLite database at:", DB_PATH);

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Projects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      original_file_name TEXT,
      original_file_size INTEGER,
      original_file_type TEXT,
      state TEXT DEFAULT 'draft', -- draft, mastering, completed, failed
      master_settings TEXT, -- JSON configuration for mastering chain
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Presets table
  db.exec(`
    CREATE TABLE IF NOT EXISTS presets (
      id TEXT PRIMARY KEY,
      user_id TEXT, -- NULL for system presets
      name TEXT NOT NULL,
      is_system INTEGER DEFAULT 0,
      category TEXT, -- genre, target_platform, user
      settings_json TEXT NOT NULL, -- JSON config
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      theme TEXT DEFAULT 'dark',
      language TEXT DEFAULT 'en',
      shortcut_json TEXT,
      target_lufs REAL DEFAULT -14.0,
      default_export_format TEXT DEFAULT 'wav',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // AI Provider configuration
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_providers (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider_name TEXT NOT NULL, -- gemini, openrouter, mimo
      is_active INTEGER DEFAULT 0,
      api_key TEXT, -- Encrypted or plain API Key
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, provider_name),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // System presets are now defined in src/lib/presets/localPresets.ts (client-side)
  // No server-side seeding needed.
}

export { db };
