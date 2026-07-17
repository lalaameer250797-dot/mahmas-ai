import { InventoryAction } from '../types';

interface ConfirmationModalProps {
  action: InventoryAction;
  onConfirm: () => void;
  onCancel: () => void;
}

function fmt(n?: number, unit?: string) {
  return n != null ? `${n} ${unit ?? ''}`.trim() : '—';
}
function fmtPrice(n?: number) {
  return n != null ? `₪${n}` : '—';
}

export function ConfirmationModal({ action, onConfirm, onCancel }: ConfirmationModalProps) {
  const isPriceUpdate = action.type === 'update_price';

  const iconMap: Record<string, string> = {
    add: '➕', subtract: '➖', update: '🔄', update_price: '💰',
  };
  const labelMap: Record<string, string> = {
    add: 'הוספה למלאי', subtract: 'הפחתה מהמלאי', update: 'עדכון מלאי', update_price: 'עדכון מחיר',
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" dir="rtl">
        {/* Icon */}
        <div className="pt-6 pb-4 px-6 text-center border-b border-gray-100">
          <div className="w-16 h-16 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-3 text-3xl">
            {iconMap[action.type]}
          </div>
          <h2 className="text-lg font-bold text-gray-800">{labelMap[action.type]}</h2>
          <p className="text-sm text-gray-500 mt-0.5">אישור נדרש לפני ביצוע</p>
        </div>

        <div className="p-6 space-y-3">
          <div className="bg-gray-50 rounded-xl p-4 space-y-2.5 text-sm">
            <Row label="מוצר:" value={action.productName} bold />

            {isPriceUpdate ? (
              <>
                {action.supplierPrice !== undefined && (
                  <Row
                    label="מחיר ספק חדש:"
                    value={fmtPrice(action.supplierPrice)}
                    valueClass="text-blue-700 font-bold"
                  />
                )}
                {action.sellingPrice !== undefined && (
                  <Row
                    label="מחיר מכירה חדש:"
                    value={fmtPrice(action.sellingPrice)}
                    valueClass="text-green-700 font-bold"
                  />
                )}
                {action.supplierPrice !== undefined && action.sellingPrice !== undefined && (
                  <div className="border-t border-gray-200 pt-2">
                    <Row
                      label="רווח לכל יחידה:"
                      value={fmtPrice(action.sellingPrice - action.supplierPrice)}
                      valueClass="text-purple-600 font-bold"
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                {action.quantity != null && action.type !== 'update' && (
                  <Row
                    label="כמות לשינוי:"
                    value={`${action.type === 'add' ? '+' : '-'}${action.quantity} ${action.unit}`}
                    valueClass={action.type === 'add' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}
                  />
                )}
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">מלאי נוכחי:</span>
                  <span className="font-medium text-gray-500 line-through">
                    {fmt(action.currentQuantity, action.unit)}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-gray-200 pt-2">
                  <span className="text-gray-500">מלאי אחרי:</span>
                  <span className="text-xl font-bold text-blue-700">
                    {fmt(action.newQuantity, action.unit)}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onConfirm}
              className="flex-1 bg-green-600 text-white py-3 rounded-xl hover:bg-green-700 active:scale-95 transition-all font-bold text-sm"
            >
              ✅ כן, לבצע
            </button>
            <button
              onClick={onCancel}
              className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl hover:bg-gray-200 active:scale-95 transition-all font-medium text-sm"
            >
              ❌ ביטול
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, valueClass }: { label: string; value: string; bold?: boolean; valueClass?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500">{label}</span>
      <span className={`${bold ? 'font-bold text-gray-800' : ''} ${valueClass ?? 'text-gray-700'}`}>{value}</span>
    </div>
  );
}
