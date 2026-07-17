import { useState, useEffect, useCallback } from 'react';
import { ActiveShuk, CompletedShuk, ShukItem, Product } from '../types';

const ACTIVE_KEY = 'mahmas-active-shuk';

export function toStorageUnits(item: ShukItem, qty: number): number {
  if (!item.packSize) return qty;
  const gramsPerStorage = item.unit === 'ק"ג' ? 1000 : 1;
  return (qty * item.packSize) / gramsPerStorage;
}

function calcTotals(items: ShukItem[]) {
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

function getNextSaturday(from = new Date()): string {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  const daysUntilSat = (6 - dow + 7) % 7;
  d.setDate(d.getDate() + daysUntilSat);
  return d.toISOString().slice(0, 10);
}

export function useShuk() {
  const [shuk, setShuk] = useState<ActiveShuk | null>(() => {
    try {
      const s = localStorage.getItem(ACTIVE_KEY);
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });

  const [history, setHistory] = useState<CompletedShuk[]>([]);

  useEffect(() => {
    if (shuk) localStorage.setItem(ACTIVE_KEY, JSON.stringify(shuk));
    else localStorage.removeItem(ACTIVE_KEY);
  }, [shuk]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/shuk');
      const data = await res.json();
      if (data.success) setHistory(data.days);
    } catch (err) {
      console.error('Failed to load shuk history:', err);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const startShuk = useCallback((products: Product[]) => {
    const items: ShukItem[] = products.map(p => ({
      productId: p.id,
      productName: p.name,
      arabicName: p.arabicName,
      category: p.category,
      unit: p.unit,
      packSize: p.packSize,
      quantityTaken: 1,
      quantitySold: null,
      supplierPrice: p.supplierPrice ?? 0,
      sellingPrice: p.sellingPrice ?? 0,
      availableStock: p.quantity,
    }));
    setShuk({
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      expectedEndDate: getNextSaturday(),
      items,
      step: 'preparing',
    });
  }, []);

  const cancelShuk = useCallback(() => setShuk(null), []);

  const addItem = useCallback((product: Product, quantity: number) => {
    setShuk(prev => {
      if (!prev) return prev;
      const exists = prev.items.find(i => i.productId === product.id);
      if (exists) {
        return { ...prev, items: prev.items.map(i => i.productId === product.id ? { ...i, quantityTaken: quantity } : i) };
      }
      const newItem: ShukItem = {
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
    setShuk(prev => prev ? { ...prev, items: prev.items.filter(i => i.productId !== productId) } : prev);
  }, []);

  const updateQuantityTaken = useCallback((productId: string, qty: number) => {
    setShuk(prev => prev
      ? { ...prev, items: prev.items.map(i => i.productId === productId ? { ...i, quantityTaken: qty } : i) }
      : prev
    );
  }, []);

  const updateQuantitySold = useCallback((productId: string, qty: number) => {
    setShuk(prev => prev
      ? { ...prev, items: prev.items.map(i => i.productId === productId ? { ...i, quantitySold: qty } : i) }
      : prev
    );
  }, []);

  const goToReporting = useCallback(() => {
    setShuk(prev => prev ? { ...prev, step: 'reporting' } : prev);
  }, []);

  const goToPreparing = useCallback(() => {
    setShuk(prev => prev ? { ...prev, step: 'preparing' } : prev);
  }, []);

  const completeShuk = useCallback(async (onSubtract: (productId: string, qty: number) => void) => {
    if (!shuk) return;
    const { totalCost, totalRevenue, totalProfit } = calcTotals(shuk.items);
    const completed: CompletedShuk = {
      id: shuk.id,
      date: shuk.date,
      completedAt: new Date().toISOString(),
      items: shuk.items,
      totalCost,
      totalRevenue,
      totalProfit,
    };
    for (const item of shuk.items) {
      if (item.quantitySold != null && item.quantitySold > 0) {
        onSubtract(item.productId, toStorageUnits(item, item.quantitySold));
      }
    }
    try {
      await fetch('/api/shuk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completed),
      });
      await loadHistory();
    } catch (err) {
      console.error('Failed to save shuk day:', err);
      setHistory(prev => [completed, ...prev].slice(0, 30));
    }
    setShuk(null);
  }, [shuk, loadHistory]);

  return {
    shuk,
    history,
    startShuk,
    cancelShuk,
    addItem,
    removeItem,
    updateQuantityTaken,
    updateQuantitySold,
    goToReporting,
    goToPreparing,
    completeShuk,
    calcTotals,
  };
}
