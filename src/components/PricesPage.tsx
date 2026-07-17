import { useState, useMemo } from 'react';
import { Product } from '../types';
import { PriceEditModal } from './PriceEditModal';
import { PriceHistoryModal } from './PriceHistoryModal';

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n?: number | null) {
  if (n == null) return '—';
  return Number.isInteger(n) ? `₪${n}` : `₪${n.toFixed(1)}`;
}

// Grams contained in one storage unit (ק"ג = 1000g, גרם = 1g)
function storageUnitInGrams(unit: string): number {
  return unit === 'ק"ג' ? 1000 : 1;
}

// Price per retail pack = price per storage unit × pack fraction
function pricePerPack(pricePerStorage: number, p: Product): number | null {
  if (p.packSize == null) return null;
  return (pricePerStorage * p.packSize) / storageUnitInGrams(p.unit);
}

function packSellingPrice(p: Product): number | null {
  if (p.sellingPrice == null) return null;
  return pricePerPack(p.sellingPrice, p);
}

function packSupplierPrice(p: Product): number | null {
  if (p.supplierPrice == null) return null;
  return pricePerPack(p.supplierPrice, p);
}

// ── Sort types ────────────────────────────────────────────────────────────────

type SortKey = 'name' | 'category' | 'supplierPrice' | 'sellingPrice' | 'packPrice' | 'profit';
type SortDir = 'asc' | 'desc';

// ── Main PricesPage ───────────────────────────────────────────────────────────

interface PricesPageProps {
  products: Product[];
  onUpdatePrice: (id: string, sp?: number, sell?: number) => void;
  onUpdateMeta: (id: string, meta: { packSize?: number }) => void;
}

export function PricesPage({ products, onUpdatePrice, onUpdateMeta }: PricesPageProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [priceFilter, setPriceFilter] = useState<'all' | 'missing'>('all');

  const categories = useMemo(() => [...new Set(products.map(p => p.category))], [products]);

  const filtered = useMemo(() => {
    const q = search.trim();
    return products
      .filter(p => {
        const matchSearch = !q ||
          p.name.includes(q) ||
          (p.arabicName?.includes(q) ?? false) ||
          p.aliases.some(a => a.includes(q));
        const matchCat = !category || p.category === category;
        const matchPrice = priceFilter === 'all' ||
          (priceFilter === 'missing' && (p.supplierPrice == null || p.sellingPrice == null));
        return matchSearch && matchCat && matchPrice;
      })
      .sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        switch (sortKey) {
          case 'category':      return a.category.localeCompare(b.category, 'he') * dir;
          case 'supplierPrice': return ((a.supplierPrice ?? -1) - (b.supplierPrice ?? -1)) * dir;
          case 'sellingPrice':  return ((a.sellingPrice ?? -1) - (b.sellingPrice ?? -1)) * dir;
          case 'packPrice': {
            const pa = packSellingPrice(a) ?? -1;
            const pb = packSellingPrice(b) ?? -1;
            return (pa - pb) * dir;
          }
          case 'profit': {
            const pa = (a.sellingPrice ?? 0) - (a.supplierPrice ?? 0);
            const pb = (b.sellingPrice ?? 0) - (b.supplierPrice ?? 0);
            return (pa - pb) * dir;
          }
          default: return a.name.localeCompare(b.name, 'he') * dir;
        }
      });
  }, [products, search, category, priceFilter, sortKey, sortDir]);

  const totals = useMemo(() => {
    const withSupplier = products.filter(p => p.supplierPrice != null);
    const withSelling  = products.filter(p => p.sellingPrice != null);
    const withBoth     = products.filter(p => p.supplierPrice != null && p.sellingPrice != null);

    const unitSupplierSum = withSupplier.reduce((s, p) => s + (p.supplierPrice ?? 0), 0);
    const unitSellingSum  = withSelling .reduce((s, p) => s + (p.sellingPrice  ?? 0), 0);
    const unitProfitSum   = withBoth    .reduce((s, p) => s + (p.sellingPrice! - p.supplierPrice!), 0);

    const avgSelling = withSelling.length  ? unitSellingSum / withSelling.length  : 0;
    const avgProfit  = withBoth.length     ? unitProfitSum  / withBoth.length     : 0;
    const avgMargin  = withBoth.length && avgSelling > 0
      ? Math.round((avgProfit / avgSelling) * 100) : 0;

    const missing = products.length - withBoth.length;
    return { unitSupplierSum, unitSellingSum, unitProfitSum, avgMargin, missing, complete: withBoth.length };
  }, [products]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden" dir="rtl">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 p-2.5 sm:p-3 space-y-2 flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold text-gray-800 text-sm sm:text-base flex items-center gap-1.5">
            <span>💰</span> מחירים
          </h2>
          <div className="text-[11px] text-gray-500">
            {totals.complete}/{products.length} עם מחירים מלאים
          </div>
        </div>

        <input
          type="text"
          placeholder="🔍 חיפוש בעברית או ערבית..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-colors"
          dir="rtl"
        />

        <div className="flex gap-1.5 items-center overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5">
          <Chip label="הכל" active={!category && priceFilter === 'all'} onClick={() => { setCategory(null); setPriceFilter('all'); }} />
          {totals.missing > 0 && (
            <Chip
              label={`❗ חסרים (${totals.missing})`}
              active={priceFilter === 'missing'}
              onClick={() => setPriceFilter(f => f === 'missing' ? 'all' : 'missing')}
              color="orange"
            />
          )}
          {categories.map(cat => (
            <Chip key={cat} label={cat} active={category === cat} onClick={() => setCategory(category === cat ? null : cat)} />
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">🔍</div>
            <p className="text-sm">לא נמצאו מוצרים</p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="bg-gray-100 border-b border-gray-200 sticky top-0 z-10">
              <tr className="text-xs font-semibold text-gray-600 text-right">
                <Th label="מוצר" sortKey="name" currentSort={sortKey} dir={sortDir} onClick={handleSort} />
                <Th label="מחיר ספק" sortKey="supplierPrice" currentSort={sortKey} dir={sortDir} onClick={handleSort} align="center" />
                <Th label="מחיר מכירה" sortKey="sellingPrice" currentSort={sortKey} dir={sortDir} onClick={handleSort} align="center" />
                <Th label="גודל אריזה" sortKey="packPrice" currentSort={sortKey} dir={sortDir} onClick={handleSort} align="center" hideOnMobile />
                <Th label="מחיר / יחידה" sortKey="packPrice" currentSort={sortKey} dir={sortDir} onClick={handleSort} align="center" />
                <Th label="רווח" sortKey="profit" currentSort={sortKey} dir={sortDir} onClick={handleSort} align="center" hideOnMobile />
                <th className="px-2 py-2.5 text-center w-24">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const packSell = packSellingPrice(p);
                const packCost = packSupplierPrice(p);
                const packProfit = packSell != null && packCost != null ? packSell - packCost : null;
                const kgProfit = p.supplierPrice != null && p.sellingPrice != null
                  ? p.sellingPrice - p.supplierPrice : null;
                const margin = kgProfit != null && p.sellingPrice != null && p.sellingPrice > 0
                  ? Math.round(kgProfit / p.sellingPrice * 100) : null;
                const historyCount = p.priceHistory?.length ?? 0;
                const missing = p.supplierPrice == null || p.sellingPrice == null;

                return (
                  <tr
                    key={p.id}
                    onClick={() => setEditingProduct(p)}
                    className={`border-b border-gray-100 cursor-pointer transition-colors ${
                      missing ? 'bg-orange-50/30 hover:bg-orange-50' : 'bg-white hover:bg-blue-50/50'
                    }`}
                  >
                    {/* Name */}
                    <td className="px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 text-sm truncate">{p.name}</p>
                        {p.arabicName && (
                          <p className="text-[11px] text-gray-500 truncate">{p.arabicName}</p>
                        )}
                        <p className="text-[10px] text-gray-400">{p.category}</p>
                      </div>
                    </td>

                    {/* Supplier price (per storage unit) */}
                    <td className="px-3 py-2.5 text-center">
                      {p.supplierPrice != null ? (
                        <div>
                          <span className="text-sm font-bold text-red-600">{fmt(p.supplierPrice)}</span>
                          <p className="text-[10px] text-gray-400">/{p.unit}</p>
                        </div>
                      ) : (
                        <span className="text-[11px] text-orange-500 italic">חסר</span>
                      )}
                    </td>

                    {/* Selling price (per storage unit) */}
                    <td className="px-3 py-2.5 text-center">
                      {p.sellingPrice != null ? (
                        <div>
                          <span className="text-sm font-bold text-green-700">{fmt(p.sellingPrice)}</span>
                          <p className="text-[10px] text-gray-400">/{p.unit}</p>
                        </div>
                      ) : (
                        <span className="text-[11px] text-orange-500 italic">חסר</span>
                      )}
                    </td>

                    {/* Pack size — only relevant for weight-based products */}
                    <td className="hidden md:table-cell px-3 py-2.5 text-center">
                      {p.packSize != null ? (
                        <span className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 font-semibold">
                          {p.packSize >= 1000 ? `${p.packSize / 1000} ק"ג` : `${p.packSize} גרם`}
                        </span>
                      ) : p.unit === 'יחידה' ? (
                        <span className="text-[11px] text-gray-400">יחידה</span>
                      ) : (
                        <span className="text-[11px] text-gray-400">—</span>
                      )}
                    </td>

                    {/* Unit price (derived from pack, or same as selling price for יחידה) */}
                    <td className="px-3 py-2.5 text-center">
                      {packSell != null ? (
                        <div>
                          <p className="text-sm font-bold text-green-700">
                            ₪{Number.isInteger(packSell) ? packSell : packSell.toFixed(2)}
                          </p>
                          {packCost != null && (
                            <p className="text-[10px] text-gray-400">
                              עלות ₪{Number.isInteger(packCost) ? packCost : packCost.toFixed(2)}
                            </p>
                          )}
                        </div>
                      ) : p.unit === 'יחידה' && p.sellingPrice != null ? (
                        <div>
                          <p className="text-sm font-bold text-green-700">{fmt(p.sellingPrice)}</p>
                          {p.supplierPrice != null && (
                            <p className="text-[10px] text-gray-400">עלות {fmt(p.supplierPrice)}</p>
                          )}
                        </div>
                      ) : p.sellingPrice != null ? (
                        <span className="text-[11px] text-gray-400 italic">אין אריזה</span>
                      ) : (
                        <span className="text-[11px] text-gray-400">—</span>
                      )}
                    </td>

                    {/* Profit per unit */}
                    <td className="hidden md:table-cell px-3 py-2.5 text-center">
                      {packProfit != null ? (
                        <div className="flex flex-col items-center">
                          <span className={`text-sm font-bold ${packProfit >= 0 ? 'text-purple-700' : 'text-red-600'}`}>
                            {packProfit >= 0 ? '+' : ''}₪{Number.isInteger(packProfit) ? packProfit : packProfit.toFixed(2)}
                          </span>
                          {margin != null && (
                            <span className="text-[10px] text-gray-400">{margin}%</span>
                          )}
                        </div>
                      ) : kgProfit != null ? (
                        <span className={`text-xs font-bold ${kgProfit >= 0 ? 'text-purple-700' : 'text-red-600'}`}>
                          {kgProfit >= 0 ? '+' : ''}{fmt(kgProfit)}/ק"ג
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-2 py-2.5">
                      <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setEditingProduct(p)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="ערוך מחירים"
                        >✏️</button>
                        <button
                          onClick={() => setHistoryProduct(p)}
                          className="relative p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="היסטוריית מחירים"
                        >
                          📜
                          {historyCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-purple-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                              {historyCount > 9 ? '9+' : historyCount}
                            </span>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer: totals */}
      <div className="bg-white border-t border-gray-200 px-3 sm:px-4 py-2 flex-shrink-0 space-y-1">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[11px] text-gray-500 whitespace-nowrap">
            📊 סה״כ מחירים ליחידה:
          </p>
          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
            <MiniStat label="ספק"   value={fmt(totals.unitSupplierSum)} color="text-red-600" />
            <MiniStat label="מכירה" value={fmt(totals.unitSellingSum)}  color="text-green-700" />
            <MiniStat
              label={`רווח${totals.avgMargin > 0 ? ` (${totals.avgMargin}%)` : ''}`}
              value={fmt(totals.unitProfitSum)}
              color={totals.unitProfitSum >= 0 ? 'text-blue-700' : 'text-red-600'}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      {editingProduct && (
        <PriceEditModal
          product={editingProduct}
          onSave={(sp, sell) => onUpdatePrice(editingProduct.id, sp, sell)}
          onUpdateMeta={(meta) => onUpdateMeta(editingProduct.id, meta)}
          onClose={() => setEditingProduct(null)}
        />
      )}

      {historyProduct && (
        <PriceHistoryModal
          product={historyProduct}
          onClose={() => setHistoryProduct(null)}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Th({
  label, sortKey, currentSort, dir, onClick, align = 'right', hideOnMobile = false,
}: {
  label: string; sortKey: SortKey; currentSort: SortKey; dir: SortDir;
  onClick: (k: SortKey) => void; align?: 'right' | 'center'; hideOnMobile?: boolean;
}) {
  const active = currentSort === sortKey;
  const alignClass = align === 'center' ? 'text-center' : 'text-right';
  const hideClass = hideOnMobile ? 'hidden md:table-cell' : '';
  return (
    <th className={`px-3 py-2.5 ${alignClass} ${hideClass}`}>
      <button
        onClick={() => onClick(sortKey)}
        className={`flex items-center gap-1 hover:text-blue-600 transition-colors ${
          active ? 'text-blue-700' : 'text-gray-600'
        } ${align === 'center' ? 'mx-auto' : ''}`}
      >
        <span>{label}</span>
        <span className="text-[10px] opacity-60">
          {active ? (dir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </button>
    </th>
  );
}

function Chip({
  label, active, onClick, color = 'blue',
}: {
  label: string; active: boolean; onClick: () => void;
  color?: 'blue' | 'orange' | 'red';
}) {
  const activeColors = {
    blue:   'bg-blue-600   text-white border-blue-600',
    orange: 'bg-orange-500 text-white border-orange-500',
    red:    'bg-red-500    text-white border-red-500',
  };
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors whitespace-nowrap flex-shrink-0 ${
        active ? activeColors[color] : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
      }`}
    >
      {label}
    </button>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-gray-500 text-[11px] sm:text-xs">{label}:</span>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  );
}
