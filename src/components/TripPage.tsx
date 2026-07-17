import { useState, useMemo } from 'react';
import { Product, ActiveTrip, CompletedTrip, TripItem } from '../types';

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  return `₪${n % 1 === 0 ? n : n.toFixed(1)}`;
}
function fmtNum(n: number) {
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}
function fmtISODate(iso: string) {
  const d = new Date(iso);
  const day   = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${day}/${month}`;
}
function isSaturday(iso: string) {
  return new Date(iso).getDay() === 6;
}
// Grams in one storage unit (ק"ג=1000, גרם=1, else fall back to 1)
function storageUnitInGrams(unit: string): number {
  return unit === 'ק"ג' ? 1000 : 1;
}
// A "unit" on shook day = a retail pack if packSize defined; otherwise raw
// storage unit. Works for products stored in ק"ג OR גרם.
function toStorage(item: TripItem, qty: number): number {
  if (item.packSize) return (qty * item.packSize) / storageUnitInGrams(item.unit);
  return qty;
}
function unitCost(item: TripItem)   { return toStorage(item, 1) * item.supplierPrice; }
function unitPrice(item: TripItem)  { return toStorage(item, 1) * item.sellingPrice; }
function itemCost(item: TripItem)    { return toStorage(item, item.quantitySold ?? 0) * item.supplierPrice; }
function itemRevenue(item: TripItem) { return toStorage(item, item.quantitySold ?? 0) * item.sellingPrice; }
function itemTakenCost(item: TripItem) { return toStorage(item, item.quantityTaken) * item.supplierPrice; }

// Human-friendly label of a shook-day "unit"
function unitLabel(item: TripItem): string {
  if (item.packSize) return `${item.packSize} גרם`;
  return item.unit;
}
// How many "shook units" fit in the current stock
function stockInUnits(item: TripItem): number | null {
  if (item.availableStock == null) return null;
  if (item.packSize) return Math.floor((item.availableStock * storageUnitInGrams(item.unit)) / item.packSize);
  return item.availableStock;
}

// ── No-trip screen ────────────────────────────────────────────────────────────

function NoTripView({ onStart, history }: { onStart: () => void; history: CompletedTrip[] }) {
  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-y-auto" dir="rtl">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
        <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center text-4xl mb-4">🛒</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">יום שוק</h2>
        <p className="text-gray-500 text-sm mb-3 leading-relaxed">
          עדכן כמה <b>יחידות</b> אתה לוקח לשוק (100/200 גרם וכו׳).<br />
          בסוף השבוע — עדכן כמה נשאר, וזה יחשב את הנמכר.
        </p>
        <p className="text-[11px] text-blue-600 mb-8">📅 יום השוק נסגר תמיד בשבת</p>
        <button
          onClick={onStart}
          className="bg-blue-600 text-white px-8 py-3 rounded-xl text-base font-bold hover:bg-blue-700 active:scale-95 transition-all shadow-md"
        >
          🆕 התחל יום שוק חדש
        </button>
      </div>

      {history.length > 0 && (
        <div className="px-4 pb-6">
          <h3 className="font-semibold text-gray-600 text-sm mb-3 flex items-center gap-2">
            <span>📅</span> יציאות אחרונות
          </h3>
          <div className="space-y-2">
            {history.slice(0, 8).map(t => (
              <div key={t.id} className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-700 text-sm">{t.date}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.totalProfit >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {t.totalProfit >= 0 ? '✅' : '❌'} {fmtCurrency(Math.abs(t.totalProfit))} {t.totalProfit >= 0 ? 'רווח' : 'הפסד'}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>עלות: <b className="text-red-500">{fmtCurrency(t.totalCost)}</b></span>
                  <span>הכנסה: <b className="text-green-600">{fmtCurrency(t.totalRevenue)}</b></span>
                  <span>{t.items.filter(i => (i.quantitySold ?? 0) > 0).length} מוצרים</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Trip header (shared) ─────────────────────────────────────────────────────

function TripHeader({
  trip, step, onCancel,
}: {
  trip: ActiveTrip; step: 1 | 2; onCancel: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const isEndDay = trip.expectedEndDate && (today >= trip.expectedEndDate || isSaturday(today));

  return (
    <div className="bg-white border-b border-gray-200 px-3 sm:px-4 py-2.5 sm:py-3 flex-shrink-0 space-y-2">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h2 className="font-bold text-gray-800 text-sm sm:text-base flex items-center gap-2">
            🛒 יום שוק — {trip.date}
          </h2>
          {trip.expectedEndDate && (
            <p className={`text-[11px] ${isEndDay ? 'text-green-700 font-semibold' : 'text-gray-500'}`}>
              {isEndDay
                ? `🏁 היום שבת — זמן לסיים!`
                : `📅 ייסגר בשבת ${fmtISODate(trip.expectedEndDate)}`}
            </p>
          )}
        </div>
        <button
          onClick={() => { if (window.confirm('לבטל את יום השוק?')) onCancel(); }}
          className="text-gray-400 hover:text-red-500 text-xs px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
        >
          ✕ בטל
        </button>
      </div>
      <StepIndicator step={step} />
    </div>
  );
}

// ── Trip toolbar (search + category chips) ───────────────────────────────────

function TripToolbar({
  items, search, setSearch, category, setCategory, extraChips,
}: {
  items: TripItem[];
  search: string; setSearch: (v: string) => void;
  category: string | null; setCategory: (v: string | null) => void;
  extraChips?: React.ReactNode;
}) {
  const categories = useMemo(() =>
    [...new Set(items.map(i => i.category).filter(Boolean) as string[])],
    [items],
  );

  return (
    <div className="bg-white border-b border-gray-200 px-3 sm:px-4 py-2 flex-shrink-0 space-y-2">
      <input
        type="text"
        placeholder="🔍 חפש מוצר..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-colors"
        dir="rtl"
      />
      <div className="flex gap-1.5 items-center overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5">
        <TripChip label="הכל" active={!category} onClick={() => setCategory(null)} />
        {extraChips}
        {categories.map(cat => (
          <TripChip key={cat} label={cat} active={category === cat} onClick={() => setCategory(category === cat ? null : cat)} />
        ))}
      </div>
    </div>
  );
}

// ── Step 1: Preparing — table with editable "taking" quantities ──────────────

function PreparingView({
  trip,
  onUpdateQty,
  onProceedToEnd,
  onCancel,
}: {
  trip: ActiveTrip;
  onUpdateQty: (id: string, qty: number) => void;
  onProceedToEnd: () => void;
  onCancel: () => void;
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [showTakenOnly, setShowTakenOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim();
    return trip.items.filter(item => {
      const matchSearch = !q ||
        item.productName.includes(q) ||
        (item.arabicName?.includes(q) ?? false);
      const matchCat = !category || item.category === category;
      const matchTaken = !showTakenOnly || item.quantityTaken > 0;
      return matchSearch && matchCat && matchTaken;
    });
  }, [trip.items, search, category, showTakenOnly]);

  const takenCount = trip.items.filter(i => i.quantityTaken > 0).length;
  const totalTaken = trip.items.reduce((s, i) => s + itemTakenCost(i), 0);

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden" dir="rtl">
      <TripHeader trip={trip} step={1} onCancel={onCancel} />
      <TripToolbar
        items={trip.items}
        search={search}
        setSearch={setSearch}
        category={category}
        setCategory={setCategory}
        extraChips={
          <TripChip
            label={`✔ מולאו (${takenCount})`}
            active={showTakenOnly}
            onClick={() => setShowTakenOnly(v => !v)}
            color="blue"
          />
        }
      />

      {/* Compact table */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <table className="w-full border-collapse">
            <thead className="bg-gray-100 border-b border-gray-200 sticky top-0 z-10 text-[11px] font-semibold text-gray-600">
              <tr>
                <th className="px-3 py-2 text-right">מוצר</th>
                <th className="px-3 py-2 text-center hidden md:table-cell w-24">במחסן (יח׳)</th>
                <th className="px-3 py-2 text-center w-40">לוקח (יח׳)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <PreparingRow
                  key={item.productId}
                  item={item}
                  onUpdateQty={qty => onUpdateQty(item.productId, qty)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 px-3 sm:px-4 py-2.5 sm:py-3 flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <span className="text-gray-600"><b className="text-blue-700">{takenCount}</b> פריטים מולאו</span>
          {totalTaken > 0 && (
            <span className="text-gray-600">
              עלות: <b className="text-red-600">{fmtCurrency(totalTaken)}</b>
            </span>
          )}
        </div>
        <button
          onClick={onProceedToEnd}
          disabled={takenCount === 0}
          className="w-full bg-blue-600 text-white py-3 sm:py-3.5 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
        >
          {takenCount === 0 ? 'עדכן כמויות תחילה' : 'סיים יום שוק ▶'}
        </button>
      </div>
    </div>
  );
}

function PreparingRow({
  item,
  onUpdateQty,
}: {
  item: TripItem;
  onUpdateQty: (qty: number) => void;
}) {
  const isTaken = item.quantityTaken > 0;
  const unitsInStock = stockInUnits(item);
  const overStock = unitsInStock != null && item.quantityTaken > unitsInStock;
  const label = unitLabel(item);
  const perUnitCost = unitCost(item);

  return (
    <tr className={`border-b border-gray-100 ${isTaken ? 'bg-blue-50/50' : 'bg-white'}`}>
      <td className="px-3 py-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">{item.productName}</p>
          {item.arabicName && (
            <p className="text-[10px] text-gray-500 truncate">{item.arabicName}</p>
          )}
          {/* pack size label */}
          <div className="flex gap-2 items-center mt-0.5 flex-wrap text-[10px]">
            <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-semibold">
              יחידה = {label}
            </span>
            {perUnitCost > 0 && (
              <span className="text-red-600">עלות: ₪{perUnitCost.toFixed(1)}/יח׳</span>
            )}
          </div>
        </div>
      </td>
      <td className="hidden md:table-cell px-3 py-2 text-center text-xs text-gray-500">
        {unitsInStock != null ? `${unitsInStock} יח׳` : '—'}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1 justify-end">
          <QtyStepper
            value={item.quantityTaken}
            onChange={onUpdateQty}
            /* no hard max — going over stock is only a soft warning */
            unit="יח׳"
            warn={overStock}
            step={1}
          />
        </div>
      </td>
    </tr>
  );
}

// ── Step 2: Ending — same table, user enters what's left → sold is calculated ─

function EndingView({
  trip,
  onUpdateSold,          // stored as quantitySold
  onComplete,
  onBackToPreparing,
  onCancel,
}: {
  trip: ActiveTrip;
  onUpdateSold: (id: string, sold: number) => void;
  onComplete: () => void;
  onBackToPreparing: () => void;
  onCancel: () => void;
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  // Only items actually taken to the shook are shown at end
  const taken = useMemo(() => trip.items.filter(i => i.quantityTaken > 0), [trip.items]);

  const filtered = useMemo(() => {
    const q = search.trim();
    return taken.filter(item => {
      const matchSearch = !q ||
        item.productName.includes(q) ||
        (item.arabicName?.includes(q) ?? false);
      const matchCat = !category || item.category === category;
      return matchSearch && matchCat;
    });
  }, [taken, search, category]);

  const totalRevenue = taken.reduce((s, i) => s + itemRevenue(i), 0);
  const totalCost    = taken.reduce((s, i) => s + itemCost(i), 0);
  const totalProfit  = totalRevenue - totalCost;
  const allFilled = taken.every(i => i.quantitySold !== null);

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden" dir="rtl">
      <TripHeader trip={trip} step={2} onCancel={onCancel} />
      <TripToolbar
        items={taken}
        search={search}
        setSearch={setSearch}
        category={category}
        setCategory={setCategory}
      />

      {/* Compact table */}
      <div className="flex-1 overflow-y-auto">
        {taken.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <div className="text-4xl mb-2">📦</div>
            <p className="text-sm">לא סימנת פריטים ליום השוק</p>
            <button onClick={onBackToPreparing} className="mt-4 text-blue-600 text-sm underline">
              חזור והוסף פריטים
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <table className="w-full border-collapse">
            <thead className="bg-gray-100 border-b border-gray-200 sticky top-0 z-10 text-[11px] font-semibold text-gray-600">
              <tr>
                <th className="px-3 py-2 text-right">מוצר</th>
                <th className="px-3 py-2 text-center w-16">לקחתי (יח׳)</th>
                <th className="px-3 py-2 text-center w-36">נשאר (יח׳)</th>
                <th className="px-3 py-2 text-center hidden md:table-cell w-24">נמכר</th>
                <th className="px-3 py-2 text-center hidden md:table-cell w-20">רווח</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <EndingRow
                  key={item.productId}
                  item={item}
                  onUpdateSold={onUpdateSold}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Summary + Complete */}
      <div className="bg-white border-t border-gray-200 p-3 sm:p-4 flex-shrink-0 space-y-2">
        <div className="bg-gray-50 rounded-xl p-2.5 grid grid-cols-3 gap-2 text-center">
          <SummaryCell label="עלות" value={fmtCurrency(totalCost)} valueClass="text-red-600" />
          <SummaryCell label="הכנסה" value={totalRevenue > 0 ? fmtCurrency(totalRevenue) : '—'} valueClass="text-green-700" />
          <SummaryCell
            label="רווח נקי"
            value={totalRevenue > 0 ? fmtCurrency(totalProfit) : '—'}
            valueClass={totalProfit >= 0 ? 'text-blue-700' : 'text-red-600'}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={onBackToPreparing}
            className="px-4 py-3 rounded-xl border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 flex-shrink-0"
          >
            ◀ חזור
          </button>
          <button
            onClick={() => {
              if (!allFilled) {
                if (!window.confirm('לא כל הכמויות מולאו. להשלים בכל זאת?')) return;
              }
              if (window.confirm('לסיים את יום השוק ולעדכן את המלאי?')) onComplete();
            }}
            disabled={taken.length === 0}
            className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 disabled:opacity-40 transition-all active:scale-[0.98]"
          >
            🏁 שמור וסיים
          </button>
        </div>
      </div>
    </div>
  );
}

function EndingRow({
  item,
  onUpdateSold,
}: {
  item: TripItem;
  onUpdateSold: (id: string, sold: number) => void;
}) {
  // User edits "remaining" (in units) — we translate to sold = taken - remaining
  const sold = item.quantitySold ?? 0;
  const remaining = item.quantityTaken - sold;
  const revenue = itemRevenue(item);
  const cost = itemCost(item);
  const profit = revenue - cost;
  const filled = item.quantitySold !== null;
  const label = unitLabel(item);
  const perUnitPrice = unitPrice(item);

  const setRemaining = (r: number) => {
    const clamped = Math.max(0, Math.min(item.quantityTaken, r));
    onUpdateSold(item.productId, item.quantityTaken - clamped);
  };

  return (
    <tr className={`border-b border-gray-100 ${filled && sold > 0 ? 'bg-green-50/50' : 'bg-white'}`}>
      <td className="px-3 py-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">{item.productName}</p>
          {item.arabicName && (
            <p className="text-[10px] text-gray-500 truncate">{item.arabicName}</p>
          )}
          <div className="flex gap-2 items-center mt-0.5 flex-wrap text-[10px]">
            <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-semibold">
              יחידה = {label}
            </span>
            {perUnitPrice > 0 && (
              <span className="text-green-700">₪{perUnitPrice.toFixed(1)}/יח׳</span>
            )}
          </div>
          {/* Mobile-only: show sold + profit inline */}
          <div className="md:hidden flex gap-2 text-[10px] mt-1">
            {filled && (
              <>
                <span className="text-green-700 font-semibold">נמכר {sold} יח׳</span>
                {sold > 0 && (
                  <span className={profit >= 0 ? 'text-blue-700 font-semibold' : 'text-red-600 font-semibold'}>
                    {profit >= 0 ? '+' : ''}{fmtCurrency(profit)}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </td>
      <td className="px-3 py-2 text-center text-xs text-gray-600">
        {fmtNum(item.quantityTaken)} יח׳
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1 justify-end">
          <QtyStepper
            value={remaining}
            onChange={setRemaining}
            max={item.quantityTaken}
            unit="יח׳"
            emptyValue={filled ? remaining : null}
            step={1}
          />
        </div>
      </td>
      <td className="hidden md:table-cell px-3 py-2 text-center">
        {filled ? (
          <span className="text-sm font-bold text-green-700">
            {fmtNum(sold)} יח׳
          </span>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>
      <td className="hidden md:table-cell px-3 py-2 text-center">
        {filled && sold > 0 ? (
          <span className={`text-xs font-bold ${profit >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
            {profit >= 0 ? '+' : ''}{fmtCurrency(profit)}
          </span>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>
    </tr>
  );
}

// ── Shared quantity stepper (used in both steps) ──────────────────────────────

function QtyStepper({
  value, onChange, max, unit, warn = false, emptyValue = 0, step = 0.5,
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
  unit: string;
  warn?: boolean;
  emptyValue?: number | null;
  step?: number;
}) {
  const showEmpty = emptyValue === null;
  return (
    <div className="flex items-center gap-1">
      <div className={`flex items-center border rounded-lg overflow-hidden bg-white ${
        warn ? 'border-orange-400' : 'border-gray-300'
      }`}>
        <button
          onClick={() => onChange(Math.max(0, value - step))}
          className="px-2 py-1.5 text-gray-600 hover:bg-gray-100 font-bold text-base"
          aria-label="הפחת"
        >−</button>
        <input
          type="number"
          min="0"
          {...(max !== undefined ? { max } : {})}
          step={step}
          value={showEmpty ? '' : (value || '')}
          onChange={e => {
            const v = parseFloat(e.target.value);
            if (isNaN(v)) { onChange(0); return; }
            const clamped = max !== undefined ? Math.min(v, max) : v;
            onChange(Math.max(0, clamped));
          }}
          placeholder="0"
          className="w-12 text-center py-1.5 text-sm font-bold focus:outline-none"
          dir="ltr"
        />
        <button
          onClick={() => {
            const next = value + step;
            onChange(max !== undefined ? Math.min(next, max) : next);
          }}
          className="px-2 py-1.5 text-gray-600 hover:bg-gray-100 font-bold text-base"
          aria-label="הוסף"
        >+</button>
      </div>
      <span className="text-[10px] text-gray-400 hidden sm:inline">{unit}</span>
    </div>
  );
}

// ── Small pieces ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="text-center py-10 text-gray-400">
      <div className="text-4xl mb-2">🔍</div>
      <p className="text-sm">לא נמצאו מוצרים</p>
    </div>
  );
}

function TripChip({
  label, active, onClick, color = 'gray',
}: {
  label: string; active: boolean; onClick: () => void; color?: 'gray' | 'blue' | 'green';
}) {
  const activeClasses = {
    gray:  'bg-gray-800 text-white border-gray-800',
    blue:  'bg-blue-600 text-white border-blue-600',
    green: 'bg-green-600 text-white border-green-600',
  };
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors whitespace-nowrap flex-shrink-0 ${
        active ? activeClasses[color] : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
      }`}
    >
      {label}
    </button>
  );
}

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2 mt-1">
      <StepDot n={1} active={step >= 1} done={step > 1} label="התחלה" />
      <div className={`flex-1 h-px ${step > 1 ? 'bg-blue-500' : 'bg-gray-300'}`} />
      <StepDot n={2} active={step >= 2} done={false} label="סיום" />
    </div>
  );
}

function StepDot({ n, active, done, label }: { n: number; active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
        done ? 'bg-green-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
      }`}>
        {done ? '✓' : n}
      </div>
      <span className={`text-[10px] ${active ? 'text-blue-700 font-medium' : 'text-gray-400'}`}>{label}</span>
    </div>
  );
}

function SummaryCell({ label, value, valueClass }: { label: string; value: string; valueClass: string }) {
  return (
    <div>
      <p className={`text-base font-bold ${valueClass}`}>{value}</p>
      <p className="text-[10px] sm:text-[11px] text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

// ── Main TripPage ─────────────────────────────────────────────────────────────

interface TripPageProps {
  products: Product[];                                // unused (kept for API stability)
  trip: ActiveTrip | null;
  history: CompletedTrip[];
  onStartTrip: () => void;
  onCancelTrip: () => void;
  onAddItem: (p: Product, qty: number) => void;      // unused
  onRemoveItem: (id: string) => void;                 // unused
  onUpdateQuantityTaken: (id: string, qty: number) => void;
  onUpdateQuantitySold: (id: string, qty: number) => void;
  onGoToReporting: () => void;
  onGoToPreparing: () => void;
  onCompleteTrip: () => void;
}

export function TripPage({
  trip, history,
  onStartTrip, onCancelTrip,
  onUpdateQuantityTaken, onUpdateQuantitySold,
  onGoToReporting, onGoToPreparing, onCompleteTrip,
}: TripPageProps) {
  if (!trip) {
    return <NoTripView onStart={onStartTrip} history={history} />;
  }
  if (trip.step === 'preparing') {
    return (
      <PreparingView
        trip={trip}
        onUpdateQty={onUpdateQuantityTaken}
        onProceedToEnd={onGoToReporting}
        onCancel={onCancelTrip}
      />
    );
  }
  return (
    <EndingView
      trip={trip}
      onUpdateSold={onUpdateQuantitySold}
      onComplete={onCompleteTrip}
      onBackToPreparing={onGoToPreparing}
      onCancel={onCancelTrip}
    />
  );
}
