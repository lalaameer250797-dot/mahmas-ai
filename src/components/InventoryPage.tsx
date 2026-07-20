import { useState, useMemo } from 'react';
import { Product } from '../types';
import { PriceEditModal } from './PriceEditModal';
import { PriceHistoryModal } from './PriceHistoryModal';
import { ProductDetailSheet } from './ProductDetailSheet';

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n?: number | null) {
  if (n == null) return '—';
  return Number.isInteger(n) ? `₪${n}` : `₪${n.toFixed(1)}`;
}

function fmtNum(n?: number | null) {
  if (n == null) return '—';
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}

function storageUnitInGrams(unit: string): number {
  return unit === 'ק"ג' ? 1000 : 1;
}

function unitLabel(p: Product): string {
  if (p.packSize) return `${p.packSize} גרם`;
  return p.unit;
}

// Convert stored quantity → shook-day units (works for kg and gram products)
function quantityInUnits(p: Product): number {
  if (p.packSize) return (p.quantity * storageUnitInGrams(p.unit)) / p.packSize;
  return p.quantity;
}

function getStockStatus(p: Product): 'ok' | 'low' | 'empty' {
  if (p.quantity <= 0) return 'empty';
  if (quantityInUnits(p) < 3) return 'low';
  if (p.minQuantity > 0 && p.quantity <= p.minQuantity) return 'low';
  return 'ok';
}

// ── Quantity Edit Modal ───────────────────────────────────────────────────────

function QuantityEditModal({
  product,
  onSave,
  onClose,
}: {
  product: Product;
  onSave: (newKgQuantity: number) => void;
  onClose: () => void;
}) {
  // If packSize defined, edit in units; else edit in storage unit
  const initialUnits = quantityInUnits(product);
  const [value, setValue] = useState(initialUnits.toString());
  const [mode, setMode] = useState<'set' | 'add' | 'subtract'>('set');

  const numericValue = parseFloat(value) || 0;
  const label = unitLabel(product);
  const usesUnits = product.packSize != null;

  const preview = useMemo(() => {
    const current = initialUnits;
    switch (mode) {
      case 'set':      return numericValue;
      case 'add':      return current + numericValue;
      case 'subtract': return Math.max(0, current - numericValue);
    }
  }, [mode, numericValue, initialUnits]);

  // Convert preview back to storage units for saving
  const previewInStorage = usesUnits
    ? (preview * product.packSize!) / storageUnitInGrams(product.unit)
    : preview;

  const handleSave = () => {
    onSave(previewInStorage);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-sm animate-slide-up sm:animate-fade-in" dir="rtl">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-800">📦 עדכן כמות</h2>
            <p className="text-xs text-gray-500 mt-0.5">{product.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Mode toggle */}
          <div className="grid grid-cols-3 gap-1.5 bg-gray-50 p-1 rounded-xl">
            <ModeBtn active={mode === 'set'}      onClick={() => setMode('set')}      label="קבע" />
            <ModeBtn active={mode === 'add'}      onClick={() => setMode('add')}      label="➕ הוסף" />
            <ModeBtn active={mode === 'subtract'} onClick={() => setMode('subtract')} label="➖ הפחת" />
          </div>

          {/* Current */}
          <div className="bg-gray-50 rounded-xl p-3 flex justify-between items-center">
            <span className="text-xs text-gray-500">כמות נוכחית:</span>
            <span className="font-bold text-gray-800">
              {fmtNum(initialUnits)} {usesUnits ? 'יח׳' : product.unit}
              {usesUnits && (
                <span className="text-[10px] text-gray-400 mr-1.5">
                  ({fmtNum(product.quantity)} ק"ג)
                </span>
              )}
            </span>
          </div>

          {/* Input */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">
              {mode === 'set' ? 'קבע ל' : mode === 'add' ? 'הוסף' : 'הפחת'} ({usesUnits ? 'יח׳' : product.unit})
            </label>
            <input
              type="number"
              min="0"
              step={usesUnits ? '1' : '0.5'}
              value={value}
              onChange={e => setValue(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-400 text-center"
              dir="ltr"
              autoFocus
            />
            {usesUnits && (
              <p className="text-[11px] text-gray-500 mt-1.5 text-center">
                יחידה = {label}
              </p>
            )}
          </div>

          {/* Preview */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-[11px] text-blue-700 font-semibold mb-1">כמות חדשה:</p>
            <p className="text-2xl font-bold text-blue-900">
              {fmtNum(preview)} {usesUnits ? 'יח׳' : product.unit}
            </p>
            {usesUnits && (
              <p className="text-xs text-blue-600 mt-0.5">
                = {previewInStorage.toFixed(2)} {product.unit}
              </p>
            )}
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button onClick={handleSave} className="flex-1 bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 font-bold text-sm">
            שמור
          </button>
          <button onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl hover:bg-gray-200 text-sm">
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
        active ? 'bg-white text-blue-700 shadow' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
    </button>
  );
}

// ── Add Product Modal ─────────────────────────────────────────────────────────

const PRESET_PACK_SIZES = [50, 100, 125, 150, 200, 250, 400, 500, 1000];
function packLabel(g: number): string {
  return g >= 1000 ? `${g / 1000} ק"ג` : `${g} גרם`;
}

const UNIT_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: 'ק"ג',   label: 'ק״ג',     hint: 'קילוגרם — נמכר במשקל' },
  { value: 'גרם',   label: 'גרם',     hint: 'גרם — לתבלינים יקרים' },
  { value: 'יחידה', label: 'יחידה',   hint: 'ללא משקל — שקית / חבילה' },
];

function AddProductModal({
  existingCategories,
  onAdd,
  onClose,
}: {
  existingCategories: string[];
  onAdd: (p: Omit<Product, 'id' | 'aliases'>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [arabicName, setArabicName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('ק"ג');
  const [quantity, setQuantity] = useState('0');
  const [minQuantity, setMinQuantity] = useState('0');
  const [packSize, setPackSize] = useState('');

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({
      name: name.trim(),
      arabicName: arabicName.trim() || undefined,
      category: category.trim() || 'כללי',
      unit: unit.trim() || 'יחידה',
      quantity: parseFloat(quantity) || 0,
      minQuantity: parseFloat(minQuantity) || 0,
      // packSize only applies to weight-based products (ק"ג / גרם)
      packSize: (isKg || isGram) && packSize ? parseFloat(packSize) : undefined,
    });
    onClose();
  };

  const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50 focus:bg-white transition-colors';
  const isKg     = unit === 'ק"ג';
  const isGram   = unit === 'גרם';
  const supports = isKg || isGram;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto animate-slide-up sm:animate-fade-in" dir="rtl">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-gray-800">➕ הוסף מוצר חדש</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">שם בעברית *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className={inp} placeholder="שם המוצר" dir="rtl" autoFocus />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">שם בערבית</label>
              <input type="text" value={arabicName} onChange={e => setArabicName(e.target.value)} className={inp} placeholder="اسم المنتج" dir="rtl" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">קטגוריה</label>
            <input type="text" list="cats-list" value={category} onChange={e => setCategory(e.target.value)} className={inp} placeholder="תבלינים" dir="rtl" />
            <datalist id="cats-list">
              {existingCategories.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>

          {/* Unit picker — 3 options */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">יחידת אחסון</label>
            <div className="grid grid-cols-3 gap-1.5 bg-gray-50 p-1 rounded-xl">
              {UNIT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setUnit(opt.value)}
                  className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
                    unit === opt.value ? 'bg-white text-blue-700 shadow' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              {UNIT_OPTIONS.find(o => o.value === unit)?.hint}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">כמות במלאי ({unit})</label>
              <input type="number" min="0" step={isGram ? '1' : '0.5'} value={quantity} onChange={e => setQuantity(e.target.value)} className={inp} dir="ltr" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">מינימום התרעה</label>
              <input type="number" min="0" step={isGram ? '1' : '0.5'} value={minQuantity} onChange={e => setMinQuantity(e.target.value)} className={inp} dir="ltr" />
            </div>
          </div>

          {supports && (
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">📦 יחידת מכירה (גרם)</label>
              <input type="number" min="0" step="10" value={packSize} onChange={e => setPackSize(e.target.value)} className={inp} placeholder="לדוגמה: 100" dir="ltr" />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {PRESET_PACK_SIZES.map(size => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setPackSize(size.toString())}
                    className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                      packSize === size.toString()
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {packLabel(size)}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-500 mt-2">
                💡 המחירים נקבעים בטאב "מחירים" — המחיר הוא ליחידת אחסון והוא נגזר ליחידה אוטומטית.
              </p>
            </div>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button onClick={handleAdd} disabled={!name.trim()} className="flex-1 bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 disabled:opacity-40 font-bold text-sm transition-colors">
            הוסף מוצר
          </button>
          <button onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl hover:bg-gray-200 text-sm">
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sort types ────────────────────────────────────────────────────────────────

type SortKey = 'name' | 'category' | 'quantity';
type SortDir = 'asc' | 'desc';

// ── Main InventoryPage ────────────────────────────────────────────────────────

interface InventoryPageProps {
  products: Product[];
  onUpdatePrice: (id: string, sp?: number, sell?: number) => void;
  onUpdateMeta: (id: string, meta: { packSize?: number }) => void;
  onUpdateQuantity: (id: string, newKgQuantity: number) => void;
  onAddProduct: (p: Omit<Product, 'id' | 'aliases'>) => void;
  onDeleteProduct: (id: string) => void;
}

export function InventoryPage({
  products,
  onUpdatePrice, onUpdateMeta, onUpdateQuantity,
  onAddProduct, onDeleteProduct,
}: InventoryPageProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [qtyEditProduct, setQtyEditProduct] = useState<Product | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'empty' | 'ok'>('all');

  const categories = useMemo(() => [...new Set(products.map(p => p.category))], [products]);

  const detailProduct = useMemo(
    () => products.find(p => p.id === detailProductId) ?? null,
    [products, detailProductId],
  );

  const filtered = useMemo(() => {
    const q = search.trim();
    return products
      .filter(p => {
        const matchSearch = !q ||
          p.name.includes(q) ||
          (p.arabicName?.includes(q) ?? false) ||
          p.aliases.some(a => a.includes(q));
        const matchCat = !category || p.category === category;
        const status = getStockStatus(p);
        const matchStock = stockFilter === 'all' || status === stockFilter;
        return matchSearch && matchCat && matchStock;
      })
      .sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        switch (sortKey) {
          case 'category': return a.category.localeCompare(b.category, 'he') * dir;
          case 'quantity': return (quantityInUnits(a) - quantityInUnits(b)) * dir;
          default:         return a.name.localeCompare(b.name, 'he') * dir;
        }
      });
  }, [products, search, category, stockFilter, sortKey, sortDir]);

  const totals = useMemo(() => {
    const lowCount = products.filter(p => getStockStatus(p) === 'low').length;
    const emptyCount = products.filter(p => getStockStatus(p) === 'empty').length;
    const inStockCount = products.filter(p => p.quantity > 0).length;
    const totalUnits = products.reduce((s, p) => s + quantityInUnits(p), 0);
    return { lowCount, emptyCount, inStockCount, totalUnits };
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
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-bold text-gray-800 text-sm sm:text-base flex items-center gap-1.5">
              <span>📦</span>
              <span className="hidden sm:inline">ניהול מלאי</span>
              <span className="sm:hidden">מלאי</span>
            </h2>
            <span className="text-[11px] text-gray-400 whitespace-nowrap">
              {filtered.length}/{products.length}
            </span>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white text-xs sm:text-sm px-3 sm:px-4 py-1.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex-shrink-0"
          >
            + מוצר חדש
          </button>
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
          <Chip label="הכל" active={!category} onClick={() => setCategory(null)} />
          {categories.map(cat => (
            <Chip key={cat} label={cat} active={category === cat} onClick={() => setCategory(category === cat ? null : cat)} />
          ))}
        </div>

        <div className="flex gap-1.5 items-center overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5">
          <span className="text-[11px] text-gray-500 whitespace-nowrap">מלאי:</span>
          <Chip label="הכל" active={stockFilter === 'all'} onClick={() => setStockFilter('all')} />
          <Chip label="תקין" active={stockFilter === 'ok'} onClick={() => setStockFilter('ok')} color="green" />
          <Chip label={`נמוך (${totals.lowCount})`} active={stockFilter === 'low'} onClick={() => setStockFilter('low')} color="orange" />
          <Chip label={`אזל (${totals.emptyCount})`} active={stockFilter === 'empty'} onClick={() => setStockFilter('empty')} color="red" />
        </div>
      </div>

      {/* Table — focus on stock/quantity, not prices */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">🔍</div>
            <p className="text-sm">לא נמצאו מוצרים</p>
            {!search && !category && stockFilter === 'all' && (
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 text-blue-600 text-sm underline"
              >
                הוסף מוצר ראשון
              </button>
            )}
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="bg-gray-100 border-b border-gray-200 sticky top-0 z-10">
              <tr className="text-xs font-semibold text-gray-600 text-right">
                <Th label="מוצר" sortKey="name" currentSort={sortKey} dir={sortDir} onClick={handleSort} />
                <Th label="קטגוריה" sortKey="category" currentSort={sortKey} dir={sortDir} onClick={handleSort} hideOnMobile />
                <Th label="כמות (יח׳)" sortKey="quantity" currentSort={sortKey} dir={sortDir} onClick={handleSort} align="center" />
                <th className="px-2 py-2.5 text-center w-24">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const status = getStockStatus(p);
                const units = quantityInUnits(p);
                const label = unitLabel(p);
                const usesUnits = p.packSize != null;

                const rowBg = status === 'empty' ? 'bg-red-50/50 hover:bg-red-50' :
                              status === 'low'   ? 'bg-orange-50/50 hover:bg-orange-50' :
                              'bg-white hover:bg-blue-50/50';

                return (
                  <tr
                    key={p.id}
                    onClick={() => setDetailProductId(p.id)}
                    className={`${rowBg} border-b border-gray-100 transition-colors cursor-pointer active:bg-blue-100`}
                  >
                    {/* Name */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-10 rounded-full flex-shrink-0 ${
                          status === 'ok'    ? 'bg-green-400'  :
                          status === 'low'   ? 'bg-orange-400' :
                                              'bg-red-500'
                        }`} />
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 text-sm truncate">{p.name}</p>
                          {p.arabicName && (
                            <p className="text-[11px] text-gray-500 truncate">{p.arabicName}</p>
                          )}
                          <p className="text-[10px] text-blue-600 mt-0.5">
                            יחידה = {label}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Category (desktop) */}
                    <td className="hidden md:table-cell px-3 py-2.5">
                      <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">
                        {p.category}
                      </span>
                    </td>

                    {/* Quantity in units */}
                    <td className="px-3 py-2.5 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className={`px-2.5 py-0.5 rounded-lg border text-sm font-bold ${
                          status === 'ok'    ? 'text-green-700  bg-green-50  border-green-200'  :
                          status === 'low'   ? 'text-orange-600 bg-orange-50 border-orange-200' :
                                              'text-red-600    bg-red-50    border-red-200'
                        }`}>
                          {fmtNum(units)} {usesUnits ? 'יח׳' : p.unit}
                        </span>
                        {usesUnits && (
                          <span className="text-[10px] text-gray-400 mt-0.5">
                            = {fmtNum(p.quantity)} {p.unit}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-2 py-2.5">
                      <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setQtyEditProduct(p)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="עדכן כמות"
                        >📦</button>
                        <button
                          onClick={() => {
                            if (window.confirm(`למחוק את "${p.name}" מהמלאי?`)) onDeleteProduct(p.id);
                          }}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="מחק מוצר"
                        >🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer: stock summary */}
      <div className="bg-white border-t border-gray-200 px-3 sm:px-4 py-2 flex-shrink-0">
        <div className="flex items-center justify-between gap-2 flex-wrap text-xs sm:text-sm">
          <p className="text-[11px] text-gray-500">
            📦 סיכום מלאי:
          </p>
          <div className="flex items-center gap-2 sm:gap-3">
            <MiniStat label="סה״כ יחידות" value={fmtNum(totals.totalUnits)} color="text-blue-700" />
            <MiniStat label="עם מלאי"     value={totals.inStockCount.toString()} color="text-green-700" />
            <MiniStat label="נמוך"         value={totals.lowCount.toString()} color="text-orange-600" />
            <MiniStat label="אזל"          value={totals.emptyCount.toString()} color="text-red-600" />
          </div>
        </div>
      </div>

      {/* Modals */}
      {qtyEditProduct && (
        <QuantityEditModal
          product={qtyEditProduct}
          onSave={(kg) => onUpdateQuantity(qtyEditProduct.id, kg)}
          onClose={() => setQtyEditProduct(null)}
        />
      )}

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

      {detailProduct && (
        <ProductDetailSheet
          product={detailProduct}
          onEditPrices={() => { setEditingProduct(detailProduct); setDetailProductId(null); }}
          onShowHistory={() => { setHistoryProduct(detailProduct); setDetailProductId(null); }}
          onDelete={() => {
            if (window.confirm(`למחוק את "${detailProduct.name}" מהמלאי?`)) {
              onDeleteProduct(detailProduct.id);
              setDetailProductId(null);
            }
          }}
          onClose={() => setDetailProductId(null)}
        />
      )}

      {showAddModal && (
        <AddProductModal
          existingCategories={categories}
          onAdd={onAddProduct}
          onClose={() => setShowAddModal(false)}
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
  color?: 'blue' | 'green' | 'orange' | 'red';
}) {
  const activeColors = {
    blue:   'bg-blue-600   text-white border-blue-600',
    green:  'bg-green-600  text-white border-green-600',
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
