import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';
import { fileURLToPath } from 'url';
import path from 'path';
import { existsSync } from 'fs';
import * as store from './db.js';

// ── Shuk (market day) endpoints ──────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Inventory REST endpoints ─────────────────────────────────────────────────

app.get('/api/products', async (_req, res) => {
  try {
    res.json({ success: true, products: await store.listProducts() });
  } catch (err) {
    console.error('GET /api/products failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const product = await store.createProduct(req.body);
    res.json({ success: true, product });
  } catch (err) {
    console.error('POST /api/products failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/products/:id', async (req, res) => {
  try {
    const product = await store.updateProduct(req.params.id, req.body);
    if (!product) return res.status(404).json({ success: false, error: 'מוצר לא נמצא' });
    res.json({ success: true, product });
  } catch (err) {
    console.error(`PATCH /api/products/${req.params.id} failed:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const ok = await store.deleteProduct(req.params.id);
    if (!ok) return res.status(404).json({ success: false, error: 'מוצר לא נמצא' });
    res.json({ success: true });
  } catch (err) {
    console.error(`DELETE /api/products/${req.params.id} failed:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/shuk', async (_req, res) => {
  try {
    res.json({ success: true, days: await store.listShukDays() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/shuk', async (req, res) => {
  try {
    await store.saveShukDay(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// NOTE: destructive bulk-reset endpoint was intentionally removed.
// Data must never be wiped via a single API call. If seeding is ever needed,
// do it manually by stopping the server, deleting data/mahmas.db, and restarting.

function buildInventoryText(inventory) {
  return inventory
    .map(p => {
      const prices = [];
      if (p.supplierPrice != null) prices.push(`ספק: ₪${p.supplierPrice}/${p.unit}`);
      if (p.sellingPrice != null) prices.push(`מכירה: ₪${p.sellingPrice}/${p.unit}`);
      if (p.supplierPrice != null && p.sellingPrice != null) {
        prices.push(`רווח: ₪${p.sellingPrice - p.supplierPrice}/${p.unit}`);
      }
      const priceStr = prices.length ? ` | ${prices.join(' | ')}` : ' | אין מחיר';
      const arabicLabel = p.arabicName ? ` / ${p.arabicName}` : '';
      const packStr = p.packSize ? ` | אריזת מכירה: ${p.packSize} גרם` : '';
      return `- [${p.id}] ${p.name}${arabicLabel} (נקרא גם: ${p.aliases.join(', ')}): ${p.quantity} ${p.unit}${priceStr}${packStr} | מינימום: ${p.minQuantity} ${p.unit}`;
    })
    .join('\n');
}

const TOOLS = [
  {
    name: 'respond_to_user',
    description: 'שלח תשובה מובנית למשתמש בעברית',
    input_schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['confirmation', 'clarification', 'info', 'error', 'list'],
          description: 'סוג התשובה',
        },
        message: {
          type: 'string',
          description: 'הודעה בעברית למשתמש — חובה תמיד',
        },
        action: {
          type: 'object',
          description: 'פרטי הפעולה — רק ב-type=confirmation',
          properties: {
            type: {
              type: 'string',
              enum: ['add', 'subtract', 'update', 'update_price'],
              description: 'add/subtract/update=מלאי | update_price=מחיר',
            },
            productId: { type: 'string', description: 'מזהה המוצר מהמלאי' },
            productName: { type: 'string', description: 'שם המוצר בעברית' },
            unit: { type: 'string', description: 'יחידת המידה' },
            // Inventory change fields
            quantity: { type: 'number', description: 'כמות לשינוי (add/subtract)' },
            currentQuantity: { type: 'number', description: 'כמות נוכחית (לא ל-update_price)' },
            newQuantity: { type: 'number', description: 'כמות חדשה (לא ל-update_price)' },
            // Price fields
            supplierPrice: { type: 'number', description: 'מחיר ספק חדש (update_price)' },
            sellingPrice: { type: 'number', description: 'מחיר מכירה חדש (update_price)' },
            currentSupplierPrice: { type: 'number', description: 'מחיר ספק נוכחי (update_price)' },
            currentSellingPrice: { type: 'number', description: 'מחיר מכירה נוכחי (update_price)' },
          },
          required: ['type', 'productId', 'productName', 'unit'],
        },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'אפשרויות לבחירה — ל-clarification',
        },
      },
      required: ['type', 'message'],
    },
  },
];

app.post('/api/chat', async (req, res) => {
  const { messages, inventory, audio, audioMimeType } = req.body;

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ success: false, error: 'מפתח API לא מוגדר. צור קובץ .env עם ANTHROPIC_API_KEY.' });
  }

  const inventoryText = buildInventoryText(inventory);

  const systemPrompt = `אתה עוזר AI לניהול מלאי של מחסן. אתה מדבר אך ורק בעברית.
אתה מומחה בהבנת עברית טבעית: סלנג, קיצורים, טעויות הקלדה, משפטים לא מסודרים, ומספרים במילים.

=== מלאי נוכחי ===
${inventoryText}

=== כללי הבנה ===
מספרים במילים: אחד=1, שתיים=2, שלוש=3, ארבע=4, חמש=5, שש=6, שבע=7, שמונה=8, תשע=9, עשר=10, אחד עשר=11, שנים עשר=12, חמישה עשר=15, עשרים=20, שלושים=30, חמישים=50, מאה=100, אלף=1000, חצי=0.5, רבע=0.25.
יחידות מידה: קילו/ק"ג/קג/קילוגרם → ק"ג | גרם/גר' → גרם | טון/טונות → טון.
אם יחידה לא ציוינה, השתמש ביחידת המוצר כברירת מחדל.

=== זיהוי פעולות מלאי ===
הוסף/תוסיף/שים/נכנס/קיבלנו/הגיע/בא → add
הורד/תוריד/הוצא/נלקח/יצא/מכרנו/ירד → subtract
עדכן כמות/שנה כמות/הגדר → update (כמות בלבד)
כמה/מה המלאי/מה הכמות → info
רשימה/הצג הכל/מה יש → list

=== זיהוי פעולות מחיר ===
שנה מחיר ספק / עלות / קנייה / מחיר קנייה של [מוצר] ל-X → update_price עם supplierPrice=X
שנה מחיר מכירה / שוק / מחיר שוק / תמחיר של [מוצר] ל-X → update_price עם sellingPrice=X
מחיר [מוצר] / כמה עולה [מוצר] / מה מחיר → info עם מחיר ספק + מכירה + רווח
ב-update_price, כלול גם currentSupplierPrice ו-currentSellingPrice מהמלאי.

=== כללי תגובה ===
1. תמיד קרא לפונקציה respond_to_user.
2. לפעולות שינוי מלאי (add/subtract/update): type=confirmation עם action מלא. הודעה חייבת לכלול שם מוצר, כמות, לפני ואחרי, ו"האם לבצע?".
3. לשינוי מחיר (update_price): type=confirmation, הודעה כוללת שם מוצר, המחיר הישן, המחיר החדש, ו"האם לבצע?".
4. אם יש 2+ מוצרים תואמים: type=clarification עם options.
5. אם כמות לא ציוינה לפעולת מלאי: type=clarification ובקש כמות.
6. אם מוצר לא נמצא: type=error.
7. לשאלות מידע: type=info עם תשובה ברורה.
8. לרשימות: type=list עם סיכום.
9. newQuantity: add → current+quantity | subtract → max(0, current-quantity) | update → כמות החדשה.
10. לרווח/עלות: חשב ממחירים במלאי.`;

  try {
    const apiMessages = messages.map(m => ({ role: m.role, content: m.content }));

    // If audio was sent, append it as a native audio content block
    if (audio) {
      apiMessages.push({
        role: 'user',
        content: [{ type: 'audio', source: { type: 'base64', media_type: audioMimeType || 'audio/webm', data: audio } }],
      });
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: apiMessages,
      tools: TOOLS,
      tool_choice: { type: 'tool', name: 'respond_to_user' },
    });

    const toolUse = response.content.find(c => c.type === 'tool_use');
    if (!toolUse) {
      return res.json({ success: false, error: 'תגובה לא צפויה מהשרת' });
    }

    res.json({ success: true, response: toolUse.input });
  } catch (error) {
    console.error('Anthropic API error:', error.message);
    res.status(500).json({ success: false, error: `שגיאה בחיבור לשרת AI: ${error.message}` });
  }
});

// Serve React build in production
const distPath = path.join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ שרת AI פועל על פורט ${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  ANTHROPIC_API_KEY לא מוגדר — צור קובץ .env');
  }
});
