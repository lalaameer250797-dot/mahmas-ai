import { useEffect } from 'react';
import { Product } from '../types';

interface ProductDetailSheetProps {
  product: Product;
  onEditPrices: () => void;
  onShowHistory: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function fmt(n?: number | null) {
  if (n == null) return '—';
  return Number.isInteger(n) ? `₪${n}` : `₪${n.toFixed(1)}`;
}

function fmtNum(n?: number | null) {
  if (n == null) return '—';
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const day   = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${day}/${month}`;
}

function getStockStatus(p: Product): 'ok' | 'low' | 'empty' {
  if (p.quantity <= 0) return 'empty';
  if (p.minQuantity > 0 && p.quantity <= p.minQuantity) return 'low';
  return 'ok';
}

function storageUnitInGrams(unit: string): number {
  return unit === 'ק"ג' ? 1000 : 1;
}
function packPrice(p: Product): number | null {
  if (p.sellingPrice == null || p.packSize == null) return null;
  return (p.sellingPrice * p.packSize) / storageUnitInGrams(p.unit);
}

const STATUS_STYLES = {
  ok:    { badge: 'text-green-700 bg-green-50 border-green-200',    label: 'תקין' },
  low:   { badge: 'text-orange-600 bg-orange-50 border-orange-200', label: 'נמוך' },
  empty: { badge: 'text-red-600 bg-red-50 border-red-200',          label: 'אזל' },
};

export function ProductDetailSheet({
  product, onEditPrices, onShowHistory, onDelete, onClose,
}: ProductDetailSheetProps) {
  const status = getStockStatus(product);
  const stylesForStatus = STATUS_STYLES[status];
  const profit = product.supplierPrice != null && product.sellingPrice != null
    ? product.sellingPrice - product.supplierPrice : null;
  const margin = profit != null && product.sellingPrice != null && product.sellingPrice > 0
    ? Math.round(profit / product.sellingPrice * 100) : null;
  const packSellingPrice = packPrice(product);
  const historyCount = product.priceHistory?.length ?? 0;
  const recentHistory = [...(product.priceHistory ?? [])].slice(-3).reverse();

  // Prevent background scroll when open
  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = orig; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex sm:items-center sm:justify-center" dir="rtl">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet — bottom on mobile, centered card on desktop */}
      <div
        className="relative w-full sm:w-[440px] max-h-[92vh] bg-white shadow-2xl overflow-y-auto
                   rounded-t-3xl sm:rounded-2xl
                   mt-auto sm:mt-0
                   animate-slide-up sm:animate-fade-in"
      >
        {/* Grab handle (mobile only) */}
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-3 sm:pt-5 pb-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-gray-800 text-lg leading-tight">{product.name}</h2>
            {product.arabicName && (
              <p className="text-sm text-gray-500 mt-0.5">{product.arabicName}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                {product.category}
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded-md border font-semibold ${stylesForStatus.badge}`}>
                {stylesForStatus.label}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
            aria-label="סגור"
          >×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Quantity card */}
          <div className={`rounded-2xl p-4 border-2 ${stylesForStatus.badge}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium opacity-75">כמות במלאי</p>
                <p className="text-3xl font-bold mt-0.5">
                  {fmtNum(product.quantity)}
                  <span className="text-base font-medium mr-1.5 opacity-75">{product.unit}</span>
                </p>
              </div>
              {product.minQuantity > 0 && (
                <div className="text-right text-[11px] opacity-75">
                  <p>מינימום</p>
                  <p className="font-semibold">{fmtNum(product.minQuantity)} {product.unit}</p>
                </div>
              )}
            </div>
          </div>

          {/* Prices grid */}
          <div className="grid grid-cols-3 gap-2">
            <PriceCard
              icon="💰"
              label="מחיר ספק"
              value={product.supplierPrice != null ? fmt(product.supplierPrice) : '—'}
              subLabel={product.supplierPrice != null ? `/${product.unit}` : 'לא הוגדר'}
              color="red"
            />
            <PriceCard
              icon="🏷️"
              label="מחיר מכירה"
              value={product.sellingPrice != null ? fmt(product.sellingPrice) : '—'}
              subLabel={product.sellingPrice != null ? `/${product.unit}` : 'לא הוגדר'}
              color="green"
            />
            <PriceCard
              icon="📈"
              label="רווח"
              value={profit != null ? (profit >= 0 ? '+' : '') + fmt(profit) : '—'}
              subLabel={margin != null ? `${margin}%` : 'לא זמין'}
              color={profit != null && profit >= 0 ? 'purple' : 'red'}
            />
          </div>

          {/* Pack size (retail unit) — shown for all measurable products */}
          {(product.unit === 'ק"ג' || product.unit === 'גרם') && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-blue-800 mb-1">📦 יחידת מכירה</p>
                  {product.packSize != null ? (
                    <p className="text-lg font-bold text-blue-900">
                      {product.packSize} <span className="text-sm font-medium">גרם / אריזה</span>
                    </p>
                  ) : (
                    <p className="text-sm text-blue-600 italic">לא הוגדר</p>
                  )}
                </div>
                {packSellingPrice != null && (
                  <div className="text-left">
                    <p className="text-[11px] text-blue-700 font-medium">מחיר לאריזה</p>
                    <p className="text-xl font-bold text-green-700">
                      ₪{Number.isInteger(packSellingPrice) ? packSellingPrice : packSellingPrice.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recent price history */}
          {recentHistory.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <span>📜</span> שינויי מחיר אחרונים
                </h3>
                <button
                  onClick={onShowHistory}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                >
                  צפה בהכל ({historyCount}) ←
                </button>
              </div>
              <div className="space-y-1.5">
                {recentHistory.map((entry, idx) => {
                  const up = entry.oldValue != null && entry.newValue != null && entry.newValue > entry.oldValue;
                  return (
                    <div key={idx} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-3 py-2">
                      <span>{entry.field === 'supplierPrice' ? '💰' : '🏷️'}</span>
                      <span className="text-gray-600 flex-1 truncate">
                        {entry.field === 'supplierPrice' ? 'מחיר ספק' : 'מחיר מכירה'}
                      </span>
                      <span className="text-gray-400 line-through text-[11px]">
                        {fmt(entry.oldValue)}
                      </span>
                      <span className={`font-bold ${up ? 'text-red-600' : 'text-green-600'}`}>
                        → {fmt(entry.newValue)}
                      </span>
                      <span className="text-gray-400 text-[10px]">{fmtDate(entry.date)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sticky action bar */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 grid grid-cols-3 gap-2">
          <ActionButton icon="✏️" label="ערוך" onClick={onEditPrices} color="blue" />
          <ActionButton
            icon="📜"
            label={`היסטוריה${historyCount > 0 ? ` (${historyCount})` : ''}`}
            onClick={onShowHistory}
            color="purple"
          />
          <ActionButton icon="🗑️" label="מחק" onClick={onDelete} color="red" />
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PriceCard({
  icon, label, value, subLabel, color,
}: {
  icon: string; label: string; value: string; subLabel: string;
  color: 'red' | 'green' | 'purple';
}) {
  const colors = {
    red:    { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-600' },
    green:  { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  };
  const c = colors[color];
  return (
    <div className={`rounded-xl p-2.5 text-center border ${c.bg} ${c.border}`}>
      <p className="text-[10px] text-gray-500 mb-0.5">{icon} {label}</p>
      <p className={`text-base font-bold ${c.text}`}>{value}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{subLabel}</p>
    </div>
  );
}

function ActionButton({
  icon, label, onClick, color,
}: {
  icon: string; label: string; onClick: () => void;
  color: 'blue' | 'purple' | 'red';
}) {
  const colors = {
    blue:   'bg-blue-600 hover:bg-blue-700 text-white',
    purple: 'bg-purple-100 hover:bg-purple-200 text-purple-800',
    red:    'bg-red-50 hover:bg-red-100 text-red-600',
  };
  return (
    <button
      onClick={onClick}
      className={`rounded-xl py-3 px-2 text-sm font-semibold transition-colors active:scale-95 flex flex-col items-center gap-0.5 ${colors[color]}`}
    >
      <span className="text-base">{icon}</span>
      <span className="text-[11px] leading-tight">{label}</span>
    </button>
  );
}
