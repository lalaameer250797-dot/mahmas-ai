import { useState, useCallback, useEffect } from 'react';
import { Product, InventoryAction } from '../types';

type Status = 'loading' | 'ready' | 'error';

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error ?? `שגיאה ${res.status}`);
  }
  return data;
}

export function useInventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);

  // Load once on mount
  const reload = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const data = await apiFetch<{ products: Product[] }>('/api/products');
      setProducts(data.products);
      setStatus('ready');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'שגיאה בטעינת המלאי';
      setError(msg);
      setStatus('error');
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Patch a single product on the server and merge the response back into state
  const patchProduct = useCallback(async (id: string, patch: Record<string, unknown>) => {
    // Optimistic update — merge patch locally first for snappy UX
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...(patch as Partial<Product>) } : p));
    try {
      const data = await apiFetch<{ product: Product }>(`/api/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      // Replace with server-authoritative version (includes updated history)
      setProducts(prev => prev.map(p => p.id === id ? data.product : p));
    } catch (err) {
      console.error('Failed to patch product:', err);
      reload();  // rollback optimistic update by re-syncing
    }
  }, [reload]);

  // Apply a voice/chat inventory action
  const applyAction = useCallback((action: InventoryAction) => {
    if (action.type === 'update_price') {
      patchProduct(action.productId, {
        supplierPrice: action.supplierPrice,
        sellingPrice: action.sellingPrice,
      });
    } else if (action.newQuantity !== undefined) {
      patchProduct(action.productId, { quantity: action.newQuantity });
    }
  }, [patchProduct]);

  const updateProductPrice = useCallback((id: string, supplierPrice?: number, sellingPrice?: number) => {
    const patch: Record<string, number | null> = {};
    if (supplierPrice !== undefined) patch.supplierPrice = supplierPrice;
    if (sellingPrice !== undefined) patch.sellingPrice = sellingPrice;
    if (Object.keys(patch).length) patchProduct(id, patch);
  }, [patchProduct]);

  const updateProductMeta = useCallback((id: string, meta: Partial<Pick<Product, 'packSize' | 'minQuantity' | 'unit'>>) => {
    // packSize=undefined from caller means "clear it" — translate to null for the API
    const patch: Record<string, unknown> = { ...meta };
    if ('packSize' in meta && meta.packSize === undefined) patch.packSize = null;
    patchProduct(id, patch);
  }, [patchProduct]);

  const subtractQuantity = useCallback((productId: string, quantity: number) => {
    const current = products.find(p => p.id === productId);
    if (!current) return;
    patchProduct(productId, { quantity: Math.max(0, current.quantity - quantity) });
  }, [products, patchProduct]);

  const updateProductQuantity = useCallback((productId: string, newQuantity: number) => {
    patchProduct(productId, { quantity: Math.max(0, newQuantity) });
  }, [patchProduct]);

  const addProduct = useCallback(async (productData: Omit<Product, 'id' | 'aliases'>) => {
    try {
      const data = await apiFetch<{ product: Product }>('/api/products', {
        method: 'POST',
        body: JSON.stringify({ ...productData, aliases: [] }),
      });
      setProducts(prev => [...prev, data.product]);
    } catch (err) {
      console.error('Failed to add product:', err);
    }
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    // Optimistic remove
    const backup = products;
    setProducts(prev => prev.filter(p => p.id !== id));
    try {
      await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to delete product:', err);
      setProducts(backup);
    }
  }, [products]);

  return {
    products, status, error, reload,
    applyAction, updateProductPrice, updateProductMeta, updateProductQuantity,
    subtractQuantity, addProduct, deleteProduct,
  };
}
