require('dotenv').config();
const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

// If TURSO_DATABASE_URL is not set, falls back to a local file database
// (great for local development without a Turso account yet).
const url = process.env.TURSO_DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

if (!process.env.TURSO_DATABASE_URL) {
  console.log('ℹ No TURSO_DATABASE_URL set — using a local file database (local.db). Data will not sync to Turso.');
}

const client = createClient(authToken ? { url, authToken } : { url });

// ---------- Schema ----------
async function initSchema() {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      summary TEXT,
      ingredients TEXT,
      steps TEXT,
      image_url TEXT,
      published INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      country TEXT NOT NULL,
      location TEXT,
      rating REAL NOT NULL CHECK(rating >= 0 AND rating <= 5),
      body TEXT,
      image_url TEXT,
      published INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blog_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      country TEXT,
      body TEXT,
      image_url TEXT,
      published INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS gallery_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_url TEXT NOT NULL,
      caption TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      read INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      cost_per_unit REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      selling_price REAL NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS product_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
      quantity REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      quantity_sold REAL NOT NULL,
      sale_price_per_unit REAL NOT NULL,
      cost_per_unit_snapshot REAL NOT NULL,
      profit_total REAL NOT NULL,
      sale_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
      quantity REAL NOT NULL,
      total_cost REAL NOT NULL,
      unit_cost REAL NOT NULL,
      store TEXT,
      purchase_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Safe migrations for columns added after the tables already existed in production.
  // SQLite/libSQL don't support "ADD COLUMN IF NOT EXISTS", so we try and ignore the
  // "duplicate column" error if it's already been applied.
  const migrations = [
    "ALTER TABLE ingredients ADD COLUMN current_stock REAL DEFAULT 0",
    "ALTER TABLE sales ADD COLUMN ingredients_snapshot TEXT"
  ];
  for (const sql of migrations) {
    try { await client.execute(sql); } catch (err) { /* column already exists — safe to ignore */ }
  }
}

async function ensureDefaultSettings() {
  const existing = await client.execute('SELECT key FROM settings WHERE key = ?', ['currency_symbol']);
  if (existing.rows.length === 0) {
    await client.execute({ sql: 'INSERT INTO settings (key, value) VALUES (?, ?)', args: ['currency_symbol', '৳'] });
    await client.execute({ sql: 'INSERT INTO settings (key, value) VALUES (?, ?)', args: ['currency_code', 'BDT'] });
  }
}

// ---------- Seed the admin user from .env, if not already present ----------
async function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@tastewithnahida.com').toLowerCase();
  const existing = await client.execute({ sql: 'SELECT id FROM admins WHERE email = ?', args: [email] });
  if (existing.rows.length === 0) {
    const rawPassword = process.env.ADMIN_PASSWORD || 'changeme123';
    const hash = bcrypt.hashSync(rawPassword, 10);
    await client.execute({ sql: 'INSERT INTO admins (email, password_hash) VALUES (?, ?)', args: [email, hash] });
    console.log(`✔ Admin account created: ${email}`);
  }
}

let readyPromise = null;
function ready() {
  if (!readyPromise) {
    readyPromise = initSchema().then(ensureAdmin).then(ensureDefaultSettings);
  }
  return readyPromise;
}

// ---------- Query helpers (mimic the old better-sqlite3-style API, but async) ----------
function toPlainRows(rs) {
  return rs.rows.map(row => ({ ...row }));
}

async function all(sql, args = []) {
  const rs = await client.execute({ sql, args });
  return toPlainRows(rs);
}

async function get(sql, args = []) {
  const rows = await all(sql, args);
  return rows[0] || null;
}

async function run(sql, args = []) {
  const rs = await client.execute({ sql, args });
  return {
    lastInsertRowid: rs.lastInsertRowid !== undefined ? Number(rs.lastInsertRowid) : undefined,
    changes: rs.rowsAffected
  };
}

module.exports = { client, ready, all, get, run };
