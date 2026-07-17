import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_PATH = path.join(DATA_DIR, 'mahmas.db');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Automatic backups ────────────────────────────────────────────────────────
// Any time the server starts and finds real data (products with prices or
// non-zero quantities), copy the DB to a timestamped file. Keep last 30.
// SQLite's `db.backup()` is transaction-safe and works while the DB is open.
function autoBackup() {
  try {
    if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });

    const hasRealData = db.prepare(`
      SELECT 1 FROM products
      WHERE supplier_price IS NOT NULL
         OR selling_price IS NOT NULL
         OR quantity > 0
      LIMIT 1
    `).get();
    if (!hasRealData) return;

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupPath = path.join(BACKUP_DIR, `mahmas-${stamp}.db`);

    db.backup(backupPath)
      .then(() => {
        console.log(`💾 Auto-backup saved: backups/mahmas-${stamp}.db`);
        pruneOldBackups();
      })
      .catch(err => console.warn('⚠️  Backup failed:', err.message));
  } catch (err) {
    console.warn('⚠️  Backup setup failed:', err.message);
  }
}

function pruneOldBackups(keep = 30) {
  try {
    const files = readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('mahmas-') && f.endsWith('.db'))
      .sort();                                  // ISO stamps sort chronologically
    while (files.length > keep) {
      const oldest = files.shift();
      unlinkSync(path.join(BACKUP_DIR, oldest));
    }
  } catch (err) {
    console.warn('⚠️  Backup prune failed:', err.message);
  }
}

autoBackup();

// ── Schema migrations ────────────────────────────────────────────────────────
// Additive only — new columns are added with ALTER TABLE, never dropped.
// Each migration runs at most once; the version is tracked in `meta`.

db.exec(`
  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

function getVersion() {
  const row = db.prepare(`SELECT value FROM meta WHERE key = 'schema_version'`).get();
  return row ? parseInt(row.value, 10) : 0;
}

function setVersion(v) {
  db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)`).run(v.toString());
}

function tableHasColumn(table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some(c => c.name === column);
}

const migrations = [
  // ── v1: initial schema ────────────────────────────────────────────────────
  () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id             TEXT PRIMARY KEY,
        name           TEXT NOT NULL,
        arabic_name    TEXT,
        aliases        TEXT NOT NULL DEFAULT '[]',
        quantity       REAL NOT NULL DEFAULT 0,
        unit           TEXT NOT NULL DEFAULT 'ק"ג',
        category       TEXT NOT NULL DEFAULT 'כללי',
        min_quantity   REAL NOT NULL DEFAULT 0,
        supplier_price REAL,
        selling_price  REAL,
        pack_size      REAL,
        created_at     TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS price_history (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id TEXT    NOT NULL,
        field      TEXT    NOT NULL,
        old_value  REAL,
        new_value  REAL,
        date       TEXT    NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_history_product ON price_history(product_id);
    `);
  },
  // ── v2: shuk (market day) history ────────────────────────────────────────
  () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS shuk_days (
        id           TEXT PRIMARY KEY,
        date         TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        items        TEXT NOT NULL DEFAULT '[]',
        total_cost   REAL NOT NULL DEFAULT 0,
        total_revenue REAL NOT NULL DEFAULT 0,
        total_profit  REAL NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_shuk_completed ON shuk_days(completed_at DESC);
    `);
  },
];

const currentVersion = getVersion();
for (let i = currentVersion; i < migrations.length; i++) {
  migrations[i]();
  setVersion(i + 1);
  console.log(`✅ DB migration ${i + 1} applied`);
}

// Silence lint: helper used by future migrations
void tableHasColumn;

// ── Seed on first-run only ───────────────────────────────────────────────────

const productCount = db.prepare('SELECT COUNT(*) as n FROM products').get().n;
if (productCount === 0) {
  const seedPath = path.join(__dirname, 'data', 'sampleProducts.json');
  try {
    const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
    const insert = db.prepare(`
      INSERT INTO products (id, name, arabic_name, aliases, quantity, unit, category, min_quantity, supplier_price, selling_price, pack_size)
      VALUES (@id, @name, @arabicName, @aliases, @quantity, @unit, @category, @minQuantity, @supplierPrice, @sellingPrice, @packSize)
    `);
    const tx = db.transaction((rows) => {
      for (const r of rows) {
        insert.run({
          id: r.id,
          name: r.name,
          arabicName: r.arabicName ?? null,
          aliases: JSON.stringify(r.aliases ?? []),
          quantity: r.quantity ?? 0,
          unit: r.unit ?? 'ק"ג',
          category: r.category ?? 'כללי',
          minQuantity: r.minQuantity ?? 0,
          supplierPrice: r.supplierPrice ?? null,
          sellingPrice: r.sellingPrice ?? null,
          packSize: r.packSize ?? null,
        });
      }
    });
    tx(seed);
    console.log(`🌱 Seeded ${seed.length} products from sampleProducts.json`);
  } catch (err) {
    console.warn('⚠️  Could not seed sample products:', err.message);
  }
}

// ── Row → API object ──────────────────────────────────────────────────────────

function rowToProduct(row, history = []) {
  return {
    id: row.id,
    name: row.name,
    arabicName: row.arabic_name ?? undefined,
    aliases: JSON.parse(row.aliases ?? '[]'),
    quantity: row.quantity,
    unit: row.unit,
    category: row.category,
    minQuantity: row.min_quantity,
    supplierPrice: row.supplier_price ?? undefined,
    sellingPrice: row.selling_price ?? undefined,
    packSize: row.pack_size ?? undefined,
    priceHistory: history,
  };
}

function historyRowToEntry(h) {
  return {
    date: h.date,
    field: h.field,
    oldValue: h.old_value ?? undefined,
    newValue: h.new_value ?? undefined,
  };
}

// ── CRUD API ──────────────────────────────────────────────────────────────────

const stmts = {
  listProducts:    db.prepare(`SELECT * FROM products ORDER BY category, name`),
  getProduct:      db.prepare(`SELECT * FROM products WHERE id = ?`),
  listHistoryAll:  db.prepare(`SELECT * FROM price_history ORDER BY product_id, date ASC`),
  listHistoryOne:  db.prepare(`SELECT * FROM price_history WHERE product_id = ? ORDER BY date ASC`),
  insertProduct:   db.prepare(`
    INSERT INTO products (id, name, arabic_name, aliases, quantity, unit, category, min_quantity, supplier_price, selling_price, pack_size)
    VALUES (@id, @name, @arabicName, @aliases, @quantity, @unit, @category, @minQuantity, @supplierPrice, @sellingPrice, @packSize)
  `),
  updateProduct:   db.prepare(`
    UPDATE products SET
      name = COALESCE(@name, name),
      arabic_name = COALESCE(@arabicName, arabic_name),
      aliases = COALESCE(@aliases, aliases),
      quantity = COALESCE(@quantity, quantity),
      unit = COALESCE(@unit, unit),
      category = COALESCE(@category, category),
      min_quantity = COALESCE(@minQuantity, min_quantity),
      supplier_price = COALESCE(@supplierPrice, supplier_price),
      selling_price = COALESCE(@sellingPrice, selling_price),
      pack_size = COALESCE(@packSize, pack_size),
      updated_at = datetime('now')
    WHERE id = @id
  `),
  clearPackSize:   db.prepare(`UPDATE products SET pack_size = NULL, updated_at = datetime('now') WHERE id = ?`),
  deleteProduct:   db.prepare(`DELETE FROM products WHERE id = ?`),
  insertHistory:   db.prepare(`
    INSERT INTO price_history (product_id, field, old_value, new_value)
    VALUES (?, ?, ?, ?)
  `),
};

export function listProducts() {
  const rows = stmts.listProducts.all();
  const allHistory = stmts.listHistoryAll.all();
  const byProduct = new Map();
  for (const h of allHistory) {
    if (!byProduct.has(h.product_id)) byProduct.set(h.product_id, []);
    byProduct.get(h.product_id).push(historyRowToEntry(h));
  }
  return rows.map(r => rowToProduct(r, byProduct.get(r.id) ?? []));
}

export function getProduct(id) {
  const row = stmts.getProduct.get(id);
  if (!row) return null;
  const history = stmts.listHistoryOne.all(id).map(historyRowToEntry);
  return rowToProduct(row, history);
}

export function createProduct(input) {
  const id = input.id ?? `product-${Date.now()}`;
  stmts.insertProduct.run({
    id,
    name: input.name,
    arabicName: input.arabicName ?? null,
    aliases: JSON.stringify(input.aliases ?? []),
    quantity: input.quantity ?? 0,
    unit: input.unit ?? 'ק"ג',
    category: input.category ?? 'כללי',
    minQuantity: input.minQuantity ?? 0,
    supplierPrice: input.supplierPrice ?? null,
    sellingPrice: input.sellingPrice ?? null,
    packSize: input.packSize ?? null,
  });
  return getProduct(id);
}

// Update a product; auto-records price history on supplier/selling changes.
// Pass `packSize: null` to explicitly clear it (COALESCE would otherwise preserve).
export function updateProduct(id, patch) {
  const existing = stmts.getProduct.get(id);
  if (!existing) return null;

  const tx = db.transaction(() => {
    // Log price changes to history first (only when the value actually changed)
    if (patch.supplierPrice !== undefined && patch.supplierPrice !== existing.supplier_price) {
      stmts.insertHistory.run(id, 'supplierPrice', existing.supplier_price, patch.supplierPrice);
    }
    if (patch.sellingPrice !== undefined && patch.sellingPrice !== existing.selling_price) {
      stmts.insertHistory.run(id, 'sellingPrice', existing.selling_price, patch.sellingPrice);
    }

    // COALESCE-based update ignores fields that weren't passed
    stmts.updateProduct.run({
      id,
      name:          patch.name          ?? null,
      arabicName:    patch.arabicName    ?? null,
      aliases:       patch.aliases !== undefined ? JSON.stringify(patch.aliases) : null,
      quantity:      patch.quantity      ?? null,
      unit:          patch.unit          ?? null,
      category:      patch.category      ?? null,
      minQuantity:   patch.minQuantity   ?? null,
      supplierPrice: patch.supplierPrice ?? null,
      sellingPrice:  patch.sellingPrice  ?? null,
      packSize:      patch.packSize      ?? null,
    });

    // Explicit clear for packSize (null means "remove", undefined means "leave alone")
    if (patch.packSize === null) stmts.clearPackSize.run(id);
  });

  tx();
  return getProduct(id);
}

export function deleteProduct(id) {
  const info = stmts.deleteProduct.run(id);
  return info.changes > 0;
}

// ── Shuk (market day) API ─────────────────────────────────────────────────────

export function listShukDays() {
  return db.prepare(`SELECT * FROM shuk_days ORDER BY completed_at DESC`).all().map(r => ({
    id: r.id,
    date: r.date,
    completedAt: r.completed_at,
    items: JSON.parse(r.items),
    totalCost: r.total_cost,
    totalRevenue: r.total_revenue,
    totalProfit: r.total_profit,
  }));
}

export function saveShukDay(day) {
  db.prepare(`
    INSERT OR REPLACE INTO shuk_days (id, date, completed_at, items, total_cost, total_revenue, total_profit)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    day.id,
    day.date,
    day.completedAt,
    JSON.stringify(day.items),
    day.totalCost,
    day.totalRevenue,
    day.totalProfit,
  );
}

// NOTE: bulk reset/wipe functions were intentionally removed to protect data.
// Individual products can still be deleted through `deleteProduct(id)`, but
// there is no code path that wipes the entire products table anymore.

export default db;
