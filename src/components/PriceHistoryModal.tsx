import { Product, PriceHistoryEntry } from '../types';

interface PriceHistoryModalProps {
  product: Product;
  onClose: () => void;
}

function fmtPrice(n?: number) {
  if (n == null) return '—';
  return Number.isInteger(n) ? `₪${n}` : `₪${n.toFixed(2)}`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const day   = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year  = d.getFullYear();
  const hh    = d.getHours().toString().padStart(2, '0');
  const mm    = d.getMinutes().toString().padStart(2, '0');
  return `${day}/${month}/${year} ${hh}:${mm}`;
}

function fieldLabel(field: PriceHistoryEntry['field']) {
  return field === 'supplierPrice' ? 'מחיר ספק' : 'מחיר מכירה';
}

function fieldIcon(field: PriceHistoryEntry['field']) {
  return field === 'supplierPrice' ? '💰' : '🏷️';
}

function changeColor(entry: PriceHistoryEntry) {
  if (entry.oldValue == null || entry.newValue == null) return 'text-gray-600';
  return entry.newValue > entry.oldValue ? 'text-red-600' : 'text-green-600';
}

function changeArrow(entry: PriceHistoryEntry) {
  if (entry.oldValue == null || entry.newValue == null) return '';
  return entry.newValue > entry.oldValue ? '↑' : '↓';
}

export function PriceHistoryModal({ product, onClose }: PriceHistoryModalProps) {
  const history = [...(product.priceHistory ?? [])].reverse();  // newest first

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh]" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <span>📜</span> היסטוריית מחירים
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {product.name}
              {product.arabicName && <span className="text-gray-400"> · {product.arabicName}</span>}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {/* Current prices summary */}
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex-shrink-0">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] text-gray-500 mb-0.5">💰 מחיר ספק</p>
              <p className="text-sm font-bold text-red-600">{fmtPrice(product.supplierPrice)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 mb-0.5">🏷️ מחיר מכירה</p>
              <p className="text-sm font-bold text-green-700">{fmtPrice(product.sellingPrice)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 mb-0.5">רווח נוכחי</p>
              <p className="text-sm font-bold text-purple-700">
                {product.supplierPrice != null && product.sellingPrice != null
                  ? fmtPrice(product.sellingPrice - product.supplierPrice)
                  : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-5">
          {history.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-3">📊</div>
              <p className="text-sm">אין שינויי מחיר עדיין</p>
              <p className="text-[11px] text-gray-400 mt-1">
                כל שינוי מחיר יתועד כאן אוטומטית
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((entry, idx) => (
                <div key={idx} className="flex gap-3">
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm">
                      {fieldIcon(entry.field)}
                    </div>
                    {idx < history.length - 1 && (
                      <div className="w-px flex-1 bg-gray-200 mt-1 min-h-4" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        {fieldLabel(entry.field)}
                      </span>
                      <span className="text-[10px] text-gray-400">{fmtDate(entry.date)}</span>
                    </div>
                    <div className="mt-1 bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-400 line-through">
                          {fmtPrice(entry.oldValue)}
                        </span>
                        <span className={`font-bold ${changeColor(entry)}`}>
                          → {fmtPrice(entry.newValue)}
                        </span>
                        {entry.oldValue != null && entry.newValue != null && (
                          <span className={`text-xs mr-auto font-semibold ${changeColor(entry)}`}>
                            {changeArrow(entry)} {fmtPrice(Math.abs(entry.newValue - entry.oldValue))}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-gray-100 text-gray-700 py-2.5 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
