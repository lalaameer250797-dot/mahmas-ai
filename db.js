import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const db = createClient({
  url: process.env.TURSO_DATABASE_URL ?? `file:${path.join(__dirname, 'data/mahmas.db')}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// ── Schema ────────────────────────────────────────────────────────────────────

await db.executeMultiple(`
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
    product_id TEXT NOT NULL,
    field      TEXT NOT NULL,
    old_value  REAL,
    new_value  REAL,
    date       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_history_product ON price_history(product_id);

  CREATE TABLE IF NOT EXISTS shuk_days (
    id            TEXT PRIMARY KEY,
    date          TEXT NOT NULL,
    completed_at  TEXT NOT NULL,
    items         TEXT NOT NULL DEFAULT '[]',
    total_cost    REAL NOT NULL DEFAULT 0,
    total_revenue REAL NOT NULL DEFAULT 0,
    total_profit  REAL NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_shuk_completed ON shuk_days(completed_at DESC);
`);

// ── Seed on first run ─────────────────────────────────────────────────────────

const { rows: countRows } = await db.execute(`SELECT COUNT(*) as n FROM products`);
if (Number(countRows[0].n) === 0) {
  const seedPath = path.join(__dirname, 'data', 'sampleProducts.json');
  try {
    const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
    await db.batch(
      seed.map(r => ({
        sql: `INSERT INTO products (id, name, arabic_name, aliases, quantity, unit, category, min_quantity, supplier_price, selling_price, pack_size)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          r.id, r.name, r.arabicName ?? null,
          JSON.stringify(r.aliases ?? []),
          r.quantity ?? 0, r.unit ?? 'ק"ג', r.category ?? 'כללי',
          r.minQuantity ?? 0, r.supplierPrice ?? null,
          r.sellingPrice ?? null, r.packSize ?? null,
        ],
      })),
      'write',
    );
    console.log(`🌱 Seeded ${seed.length} products`);
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
    quantity: Number(row.quantity),
    unit: row.unit,
    category: row.category,
    minQuantity: Number(row.min_quantity),
    supplierPrice: row.supplier_price != null ? Number(row.supplier_price) : undefined,
    sellingPrice: row.selling_price != null ? Number(row.selling_price) : undefined,
    packSize: row.pack_size != null ? Number(row.pack_size) : undefined,
    priceHistory: history,
  };
}

function historyRowToEntry(h) {
  return {
    date: h.date,
    field: h.field,
    oldValue: h.old_value != null ? Number(h.old_value) : undefined,
    newValue: h.new_value != null ? Number(h.new_value) : undefined,
  };
}

// ── CRUD API ──────────────────────────────────────────────────────────────────

export async function listProducts() {
  const [{ rows: productRows }, { rows: historyRows }] = await Promise.all([
    db.execute(`SELECT * FROM products ORDER BY category, name`),
    db.execute(`SELECT * FROM price_history ORDER BY product_id, date ASC`),
  ]);
  const byProduct = new Map();
  for (const h of historyRows) {
    if (!byProduct.has(h.product_id)) byProduct.set(h.product_id, []);
    byProduct.get(h.product_id).push(historyRowToEntry(h));
  }
  return productRows.map(r => rowToProduct(r, byProduct.get(r.id) ?? []));
}

export async function getProduct(id) {
  const [{ rows: productRows }, { rows: historyRows }] = await Promise.all([
    db.execute({ sql: `SELECT * FROM products WHERE id = ?`, args: [id] }),
    db.execute({ sql: `SELECT * FROM price_history WHERE product_id = ? ORDER BY date ASC`, args: [id] }),
  ]);
  if (productRows.length === 0) return null;
  return rowToProduct(productRows[0], historyRows.map(historyRowToEntry));
}

export async function createProduct(input) {
  const id = input.id ?? `product-${Date.now()}`;
  await db.execute({
    sql: `INSERT INTO products (id, name, arabic_name, aliases, quantity, unit, category, min_quantity, supplier_price, selling_price, pack_size)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id, input.name, input.arabicName ?? null,
      JSON.stringify(input.aliases ?? []),
      input.quantity ?? 0, input.unit ?? 'ק"ג', input.category ?? 'כללי',
      input.minQuantity ?? 0, input.supplierPrice ?? null,
      input.sellingPrice ?? null, input.packSize ?? null,
    ],
  });
  return getProduct(id);
}

export async function updateProduct(id, patch) {
  const { rows } = await db.execute({ sql: `SELECT * FROM products WHERE id = ?`, args: [id] });
  if (rows.length === 0) return null;
  const existing = rows[0];

  const statements = [];

  if (patch.supplierPrice !== undefined && patch.supplierPrice !== Number(existing.supplier_price)) {
    statements.push({
      sql: `INSERT INTO price_history (product_id, field, old_value, new_value) VALUES (?, ?, ?, ?)`,
      args: [id, 'supplierPrice', existing.supplier_price, patch.supplierPrice],
    });
  }
  if (patch.sellingPrice !== undefined && patch.sellingPrice !== Number(existing.selling_price)) {
    statements.push({
      sql: `INSERT INTO price_history (product_id, field, old_value, new_value) VALUES (?, ?, ?, ?)`,
      args: [id, 'sellingPrice', existing.selling_price, patch.sellingPrice],
    });
  }

  statements.push({
    sql: `UPDATE products SET
      name           = COALESCE(?, name),
      arabic_name    = COALESCE(?, arabic_name),
      aliases        = COALESCE(?, aliases),
      quantity       = COALESCE(?, quantity),
      unit           = COALESCE(?, unit),
      category       = COALESCE(?, category),
      min_quantity   = COALESCE(?, min_quantity),
      supplier_price = COALESCE(?, supplier_price),
      selling_price  = COALESCE(?, selling_price),
      pack_size      = COALESCE(?, pack_size),
      updated_at     = datetime('now')
    WHERE id = ?`,
    args: [
      patch.name          ?? null,
      patch.arabicName    ?? null,
      patch.aliases !== undefined ? JSON.stringify(patch.aliases) : null,
      patch.quantity      ?? null,
      patch.unit          ?? null,
      patch.category      ?? null,
      patch.minQuantity   ?? null,
      patch.supplierPrice ?? null,
      patch.sellingPrice  ?? null,
      patch.packSize      ?? null,
      id,
    ],
  });

  if (patch.packSize === null) {
    statements.push({
      sql: `UPDATE products SET pack_size = NULL, updated_at = datetime('now') WHERE id = ?`,
      args: [id],
    });
  }

  await db.batch(statements, 'write');
  return getProduct(id);
}

export async function deleteProduct(id) {
  const { rowsAffected } = await db.execute({ sql: `DELETE FROM products WHERE id = ?`, args: [id] });
  return rowsAffected > 0;
}

// ── Shuk (market day) API ─────────────────────────────────────────────────────

export async function listShukDays() {
  const { rows } = await db.execute(`SELECT * FROM shuk_days ORDER BY completed_at DESC`);
  return rows.map(r => ({
    id: r.id,
    date: r.date,
    completedAt: r.completed_at,
    items: JSON.parse(r.items),
    totalCost: Number(r.total_cost),
    totalRevenue: Number(r.total_revenue),
    totalProfit: Number(r.total_profit),
  }));
}

export async function saveShukDay(day) {
  await db.execute({
    sql: `INSERT OR REPLACE INTO shuk_days (id, date, completed_at, items, total_cost, total_revenue, total_profit)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [day.id, day.date, day.completedAt, JSON.stringify(day.items), day.totalCost, day.totalRevenue, day.totalProfit],
  });
}

export default db;
