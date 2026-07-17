import { useState, useEffect, useCallback } from 'react';
import { ActiveTrip, CompletedTrip, TripItem, Product } from '../types';

const ACTIVE_KEY = 'mahmas-active-trip';
const HISTORY_KEY = 'mahmas-trip-history';

// Convert a shook-day quantity (packs OR raw storage units) to storage units.
// If packSize is defined, quantities are packs and we scale by packSize / storageUnitInGrams.
export function toStorageUnits(item: TripItem, qty: number): number {
  if (!item.packSize) return qty;
  const gramsPerStorage = item.unit === 'ק"ג' ? 1000 : 1;
  return (qty * item.packSize) / gramsPerStorage;
}

function calcTotals(items: TripItem[]) {
  // Cost is the cost of goods actually sold. Revenue = sold * selling price.
  // All prices are per storage-unit (per ק"ג), so we convert sold quantity first.
  let totalCost = 0;
  let totalRevenue = 0;
  for (const item of items) {
    const sold = item.quantitySold ?? 0;
    const soldInStorageUnits = toStorageUnits(item, sold);
    totalCost    += soldInStorageUnits * item.supplierPrice;
    totalRevenue += soldInStorageUnits * item.sellingPrice;
  }
  return { totalCost, totalRevenue, totalProfit: totalRevenue - totalCost };
}

// Next Saturday (or today if today is Saturday). Returns ISO date (YYYY-MM-DD).
function getNextSaturday(from = new Date()): string {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();                  // 0 = Sunday ... 6 = Saturday
  const daysUntilSat = (6 - dow + 7) % 7;
  d.setDate(d.getDate() + daysUntilSat);
  return d.toISOString().slice(0, 10);
}

export function useTrip() {
  const [trip, setTrip] = useState<ActiveTrip | null>(() => {
    try {
      const s = localStorage.getItem(ACTIVE_KEY);
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });

  const [history, setHistory] = useState<CompletedTrip[]>(() => {
    try {
      const s = localStorage.getItem(HISTORY_KEY);
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });

  useEffect(() => {
    if (trip) localStorage.setItem(ACTIVE_KEY, JSON.stringify(trip));
    else localStorage.removeItem(ACTIVE_KEY);
  }, [trip]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  const startTrip = useCallback((products: Product[]) => {
    // All items go into the day's table. Quantities start at 0 — user fills
    // in "how many units I'm taking" for each product. If the product has a
    // packSize, quantities are counted in packs; otherwise in storage units.
    const items: TripItem[] = products.map(p => ({
      productId: p.id,
      productName: p.name,
      arabicName: p.arabicName,
      category: p.category,
      unit: p.unit,
      packSize: p.packSize,
      quantityTaken: 0,
      quantitySold: null,
      supplierPrice: p.supplierPrice ?? 0,
      sellingPrice: p.sellingPrice ?? 0,
      availableStock: p.quantity,
    }));
    setTrip({
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      expectedEndDate: getNextSaturday(),
      items,
      step: 'preparing',
    });
  }, []);

  const cancelTrip = useCallback(() => setTrip(null), []);

  const addItem = useCallback((product: Product, quantity: number) => {
    setTrip(prev => {
      if (!prev) return prev;
      const exists = prev.items.find(i => i.productId === product.id);
      if (exists) {
        return { ...prev, items: prev.items.map(i => i.productId === product.id ? { ...i, quantityTaken: quantity } : i) };
      }
      const newItem: TripItem = {
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        quantityTaken: quantity,
        quantitySold: null,
        supplierPrice: product.supplierPrice ?? 0,
        sellingPrice: product.sellingPrice ?? 0,
      };
      return { ...prev, items: [...prev.items, newItem] };
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setTrip(prev => prev ? { ...prev, items: prev.items.filter(i => i.productId !== productId) } : prev);
  }, []);

  const updateQuantityTaken = useCallback((productId: string, qty: number) => {
    setTrip(prev => prev
      ? { ...prev, items: prev.items.map(i => i.productId === productId ? { ...i, quantityTaken: qty } : i) }
      : prev
    );
  }, []);

  const updateQuantitySold = useCallback((productId: string, qty: number) => {
    setTrip(prev => prev
      ? { ...prev, items: prev.items.map(i => i.productId === productId ? { ...i, quantitySold: qty } : i) }
      : prev
    );
  }, []);

  const goToReporting = useCallback(() => {
    setTrip(prev => prev ? { ...prev, step: 'reporting' } : prev);
  }, []);

  const goToPreparing = useCallback(() => {
    setTrip(prev => prev ? { ...prev, step: 'preparing' } : prev);
  }, []);

  const completeTrip = useCallback((onSubtract: (productId: string, qty: number) => void) => {
    if (!trip) return;
    const { totalCost, totalRevenue, totalProfit } = calcTotals(trip.items);
    const completed: CompletedTrip = {
      id: trip.id,
      date: trip.date,
      completedAt: new Date().toISOString(),
      items: trip.items,
      totalCost,
      totalRevenue,
      totalProfit,
    };
    // Deduct sold quantities from inventory — convert packs → storage units first
    for (const item of trip.items) {
      if (item.quantitySold != null && item.quantitySold > 0) {
        onSubtract(item.productId, toStorageUnits(item, item.quantitySold));
      }
    }
    setHistory(prev => [completed, ...prev].slice(0, 30));
    setTrip(null);
  }, [trip]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  }, []);

  return {
    trip,
    history,
    startTrip,
    cancelTrip,
    addItem,
    removeItem,
    updateQuantityTaken,
    updateQuantitySold,
    goToReporting,
    goToPreparing,
    completeTrip,
    clearHistory,
    calcTotals,
  };
}
