import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error('❌ Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env first');
  process.exit(1);
}

const local = createClient({ url: `file:${path.join(__dirname, 'data/mahmas.db')}` });
const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

console.log('📖 Reading local database...');
const [{ rows: products }, { rows: history }, { rows: shukDays }] = await Promise.all([
  local.execute('SELECT * FROM products'),
  local.execute('SELECT * FROM price_history'),
  local.execute('SELECT * FROM shuk_days'),
]);
console.log(`   ${products.length} products, ${history.length} price history rows, ${shukDays.length} shuk days`);

console.log('🗑  Clearing Turso tables...');
await turso.executeMultiple(`
  DELETE FROM price_history;
  DELETE FROM shuk_days;
  DELETE FROM products;
`);

console.log('📤 Pushing products...');
if (products.length > 0) {
  await turso.batch(
    products.map(p => ({
      sql: `INSERT INTO products (id, name, arabic_name, aliases, quantity, unit, category, min_quantity, supplier_price, selling_price, pack_size, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [p.id, p.name, p.arabic_name, p.aliases, p.quantity, p.unit, p.category, p.min_quantity, p.supplier_price, p.selling_price, p.pack_size, p.created_at, p.updated_at],
    })),
    'write',
  );
}

console.log('📤 Pushing price history...');
if (history.length > 0) {
  await turso.batch(
    history.map(h => ({
      sql: `INSERT INTO price_history (product_id, field, old_value, new_value, date) VALUES (?, ?, ?, ?, ?)`,
      args: [h.product_id, h.field, h.old_value, h.new_value, h.date],
    })),
    'write',
  );
}

console.log('📤 Pushing shuk days...');
if (shukDays.length > 0) {
  await turso.batch(
    shukDays.map(s => ({
      sql: `INSERT INTO shuk_days (id, date, completed_at, items, total_cost, total_revenue, total_profit) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [s.id, s.date, s.completed_at, s.items, s.total_cost, s.total_revenue, s.total_profit],
    })),
    'write',
  );
}

console.log('✅ Verifying...');
const [{ rows: [{ n: pCount }] }, { rows: [{ n: withPrices }] }] = await Promise.all([
  turso.execute('SELECT COUNT(*) as n FROM products'),
  turso.execute('SELECT COUNT(*) as n FROM products WHERE supplier_price IS NOT NULL'),
]);
console.log(`   Turso now has ${pCount} products, ${withPrices} with prices`);
console.log('🎉 Done! Your live database now has all your real data.');
