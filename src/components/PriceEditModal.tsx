import { useState } from 'react';
import { Product } from '../types';

interface PriceEditModalProps {
  product: Product;
  onSave: (supplierPrice: number | undefined, sellingPrice: number | undefined) => void;
  onUpdateMeta?: (meta: { packSize?: number }) => void;
  onClose: () => void;
}

// Grams per one storage unit (ק"ג=1000, גרם=1)
function storageUnitInGrams(unit: string): number {
  return unit === 'ק"ג' ? 1000 : 1;
}

// packSize is always in grams. Converts price per storage-unit → price per pack.
function derivePackPrice(pricePerStorage: number, packSizeGrams: number, unit: string): number {
  return (pricePerStorage * packSizeGrams) / storageUnitInGrams(unit);
}

// Preset pack sizes in grams — same list for all products (kg and gram-based)
const PACK_SIZES = [50, 100, 125, 150, 200, 250, 400, 500, 1000];

function packLabel(g: number): string {
  return g >= 1000 ? `${g / 1000} ק"ג` : `${g} גרם`;
}

export function PriceEditModal({ product, onSave, onUpdateMeta, onClose }: PriceEditModalProps) {
  const [supplierPrice, setSupplierPrice] = useState(product.supplierPrice?.toString() ?? '');
  const [sellingPrice, setSellingPrice] = useState(product.sellingPrice?.toString() ?? '');
  const [packSize, setPackSize] = useState(product.packSize?.toString() ?? '');

  const spNum   = supplierPrice ? parseFloat(supplierPrice) : null;
  const sellNum = sellingPrice ? parseFloat(sellingPrice) : null;
  const packNum = packSize ? parseFloat(packSize) : null;

  const profit = spNum != null && sellNum != null ? sellNum - spNum : null;
  const margin = profit != null && sellNum != null && sellNum > 0
    ? Math.round(profit / sellNum * 100) : null;

  const isKgProduct   = product.unit === 'ק"ג';
  const isGramProduct = product.unit === 'גרם';
  const supportsPack  = isKgProduct || isGramProduct;

  const packSellingPrice = supportsPack && sellNum != null && packNum != null
    ? derivePackPrice(sellNum, packNum, product.unit) : null;
  const packSupplierPrice = supportsPack && spNum != null && packNum != null
    ? derivePackPrice(spNum, packNum, product.unit) : null;
  const packProfit = packSellingPrice != null && packSupplierPrice != null
    ? packSellingPrice - packSupplierPrice : null;

  const handleSave = () => {
    const sp = supplierPrice !== '' ? parseFloat(supplierPrice) : undefined;
    const sell = sellingPrice !== '' ? parseFloat(sellingPrice) : undefined;
    if ((sp !== undefined && isNaN(sp)) || (sell !== undefined && isNaN(sell))) return;

    onSave(sp, sell);

    if (onUpdateMeta) {
      const newPackSize = packSize !== '' ? parseFloat(packSize) : undefined;
      if (newPackSize !== product.packSize) {
        onUpdateMeta({ packSize: newPackSize && !isNaN(newPackSize) ? newPackSize : undefined });
      }
    }

    onClose();
  };

  const fmt = (n: number) => Number.isInteger(n) ? n.toString() : n.toFixed(2);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[92vh] overflow-y-auto" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-bold text-gray-800">{product.name}</h2>
            {product.arabicName && (
              <p className="text-xs text-gray-500 mt-0.5">{product.arabicName}</p>
            )}
            <p className="text-[11px] text-gray-400 mt-0.5">עריכת מחירים ואריזה</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Supplier Price */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">
              💰 מחיר ספק (עלות)
            </label>
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₪</span>
              <input
                type="number" min="0" step="0.5"
                value={supplierPrice}
                onChange={e => setSupplierPrice(e.target.value)}
                className="w-full border border-gray-300 rounded-xl pr-8 pl-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-left"
                placeholder="0.00" dir="ltr"
              />
            </div>
            {supplierPrice && <p className="text-xs text-gray-400 mt-1">לכל {product.unit}</p>}
          </div>

          {/* Selling Price */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">
              🏷️ מחיר מכירה
            </label>
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₪</span>
              <input
                type="number" min="0" step="0.5"
                value={sellingPrice}
                onChange={e => setSellingPrice(e.target.value)}
                className="w-full border border-gray-300 rounded-xl pr-8 pl-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-left"
                placeholder="0.00" dir="ltr"
              />
            </div>
            {sellingPrice && <p className="text-xs text-gray-400 mt-1">לכל {product.unit}</p>}
          </div>

          {/* Pack size — works for both kg and gram products */}
          {supportsPack && (
            <div className="border-t border-gray-100 pt-4">
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                📦 יחידת מכירה (משקל אריזה)
              </label>
              <div className="relative mb-2">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">גרם</span>
                <input
                  type="number" min="0" step="10"
                  value={packSize}
                  onChange={e => setPackSize(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl pr-10 pl-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-left"
                  placeholder="לדוגמה: 100" dir="ltr"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PACK_SIZES.map(size => (
                  <button
                    key={size}
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
                {packSize && (
                  <button
                    onClick={() => setPackSize('')}
                    className="text-[11px] px-2 py-0.5 rounded-full border bg-gray-100 text-gray-500 border-gray-300 hover:border-red-400 hover:text-red-500"
                  >
                    × נקה
                  </button>
                )}
              </div>

              {/* Derived pack price preview */}
              {packSellingPrice != null && packNum != null && (
                <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-[11px] text-blue-700 font-semibold mb-1.5">
                    מחיר ל-{packNum} גרם:
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {packSupplierPrice != null && (
                      <div>
                        <p className="text-[10px] text-gray-500">עלות</p>
                        <p className="text-sm font-bold text-red-600">₪{fmt(packSupplierPrice)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] text-gray-500">מכירה</p>
                      <p className="text-sm font-bold text-green-700">₪{fmt(packSellingPrice)}</p>
                    </div>
                    {packProfit != null && (
                      <div>
                        <p className="text-[10px] text-gray-500">רווח</p>
                        <p className="text-sm font-bold text-purple-700">₪{fmt(packProfit)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Profit Preview (per storage unit) */}
          {profit != null && profit > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm">
              <div className="flex justify-between items-center text-green-800">
                <span>רווח לכל {product.unit}:</span>
                <span className="font-bold">₪{fmt(profit)}</span>
              </div>
              {margin != null && (
                <div className="flex justify-between items-center text-green-700 mt-1">
                  <span>מרג'ין:</span>
                  <span className="font-semibold">{margin}%</span>
                </div>
              )}
            </div>
          )}

          {profit != null && profit <= 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              ⚠️ מחיר המכירה נמוך ממחיר הספק!
            </div>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button onClick={handleSave} className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-700 transition-colors font-medium text-sm">
            שמור
          </button>
          <button onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl hover:bg-gray-200 transition-colors text-sm">
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
