export interface PriceHistoryEntry {
  date: string;                                     // ISO timestamp
  field: 'supplierPrice' | 'sellingPrice';
  oldValue?: number;
  newValue?: number;
}

export interface Product {
  id: string;
  name: string;
  arabicName?: string;
  aliases: string[];
  quantity: number;
  unit: string;                                     // storage unit (e.g. ק"ג, גרם)
  category: string;
  minQuantity: number;
  supplierPrice?: number;                           // ₪ per storage unit (cost)
  sellingPrice?: number;                            // ₪ per storage unit (revenue)
  packSize?: number;                                // retail pack weight in grams (100, 200, 50, ...)
  priceHistory?: PriceHistoryEntry[];               // log of price edits
}

export type ActionType = 'add' | 'subtract' | 'update' | 'update_price';

export interface InventoryAction {
  type: ActionType;
  productId: string;
  productName: string;
  quantity?: number;
  currentQuantity?: number;
  newQuantity?: number;
  unit: string;
  // Quantity fields (add/subtract/update)
  // Price fields (update_price)
  supplierPrice?: number;
  sellingPrice?: number;
  currentSupplierPrice?: number;
  currentSellingPrice?: number;
}

export type ResponseType = 'confirmation' | 'clarification' | 'info' | 'error' | 'list';

export interface AIResponse {
  type: ResponseType;
  message: string;
  action?: InventoryAction;
  options?: string[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  response?: AIResponse;
  timestamp: Date;
  skipFromHistory?: boolean;
}

// ── Trip (market day) types ──────────────────────────────────────────────────

export interface TripItem {
  productId: string;
  productName: string;
  arabicName?: string;
  category?: string;
  unit: string;                                     // storage unit (ק"ג / גרם)
  packSize?: number;                                // grams per retail unit (100, 200 ...)
  quantityTaken: number;                            // packs if packSize defined, else storage-unit qty
  quantitySold: number | null;
  supplierPrice: number;                            // ₪ per storage unit (per ק"ג)
  sellingPrice: number;                             // ₪ per storage unit
  availableStock?: number;                          // storage-unit stock snapshot at trip start
}

export type TripStep = 'preparing' | 'reporting';

export interface ActiveTrip {
  id: string;
  date: string;                                     // creation date
  expectedEndDate?: string;                         // ISO — next Saturday from creation
  items: TripItem[];
  step: TripStep;
}

export interface CompletedTrip {
  id: string;
  date: string;
  completedAt: string;
  items: TripItem[];
  totalCost: number;
  totalRevenue: number;
  totalProfit: number;
}
