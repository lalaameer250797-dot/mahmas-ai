import { useState, useCallback } from 'react';
import { Message, AIResponse, InventoryAction, Product } from '../types';

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: 'שלום! אני העוזר החכם לניהול המלאי שלך. תוכל לדבר איתי בעברית טבעית — להוסיף מלאי, להפחית, לשאול כמה יש, לעדכן מחירים ועוד. איך אוכל לעזור?',
  response: { type: 'info', message: '' },
  timestamp: new Date(),
  skipFromHistory: true,
};

interface UseChatOptions {
  products: Product[];
  onInventoryAction: (action: InventoryAction) => void;
}

function buildSuccessMessage(action: InventoryAction): string {
  switch (action.type) {
    case 'add':
      return `✅ הוספתי ${action.quantity} ${action.unit} ${action.productName}. המלאי עודכן מ-${action.currentQuantity} ל-${action.newQuantity} ${action.unit}.`;
    case 'subtract':
      return `✅ הפחתתי ${action.quantity} ${action.unit} ${action.productName}. המלאי עודכן מ-${action.currentQuantity} ל-${action.newQuantity} ${action.unit}.`;
    case 'update':
      return `✅ עדכנתי את מלאי ${action.productName} ל-${action.newQuantity} ${action.unit}.`;
    case 'update_price': {
      const parts: string[] = [];
      if (action.supplierPrice !== undefined) parts.push(`מחיר ספק: ₪${action.supplierPrice}/${action.unit}`);
      if (action.sellingPrice !== undefined) parts.push(`מחיר מכירה: ₪${action.sellingPrice}/${action.unit}`);
      return `✅ עדכנתי מחירי ${action.productName}: ${parts.join(' | ')}.`;
    }
    default:
      return '✅ הפעולה בוצעה בהצלחה.';
  }
}

export function useChat({ products, onInventoryAction }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ action: InventoryAction; confirmMessage: string } | null>(null);

  const addMessage = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const history = [...messages, userMessage]
        .filter(m => !m.skipFromHistory)
        .slice(-24)
        .map(m => ({ role: m.role, content: m.content }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, inventory: products }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error ?? 'שגיאה לא ידועה');

      const aiResponse: AIResponse = data.response;

      const assistantMessage: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: aiResponse.message,
        response: aiResponse,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (aiResponse.type === 'confirmation' && aiResponse.action) {
        setPendingAction({ action: aiResponse.action, confirmMessage: aiResponse.message });
      }
    } catch (err) {
      const errorText = err instanceof Error ? err.message : 'שגיאה לא ידועה';
      addMessage({
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: `מצטער, אירעה שגיאה: ${errorText}`,
        response: { type: 'error', message: errorText },
        timestamp: new Date(),
        skipFromHistory: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [messages, products, isLoading, addMessage]);

  const sendAudio = useCallback(async (audioBase64: string, mimeType: string) => {
    if (isLoading) return;

    const userMessage: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: '🎙️',
      timestamp: new Date(),
      skipFromHistory: true,
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const history = messages
        .filter(m => !m.skipFromHistory)
        .slice(-24)
        .map(m => ({ role: m.role, content: m.content }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, inventory: products, audio: audioBase64, audioMimeType: mimeType }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error ?? 'שגיאה לא ידועה');

      const aiResponse: AIResponse = data.response;

      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: aiResponse.message,
        response: aiResponse,
        timestamp: new Date(),
      }]);

      if (aiResponse.type === 'confirmation' && aiResponse.action) {
        setPendingAction({ action: aiResponse.action, confirmMessage: aiResponse.message });
      }
    } catch (err) {
      const errorText = err instanceof Error ? err.message : 'שגיאה לא ידועה';
      addMessage({
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: `מצטער, אירעה שגיאה: ${errorText}`,
        response: { type: 'error', message: errorText },
        timestamp: new Date(),
        skipFromHistory: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [messages, products, isLoading, addMessage]);

  const confirmAction = useCallback(() => {
    if (!pendingAction) return;
    onInventoryAction(pendingAction.action);
    addMessage({
      id: `c-${Date.now()}`,
      role: 'assistant',
      content: buildSuccessMessage(pendingAction.action),
      response: { type: 'info', message: '' },
      timestamp: new Date(),
      skipFromHistory: true,
    });
    setPendingAction(null);
  }, [pendingAction, onInventoryAction, addMessage]);

  const cancelAction = useCallback(() => {
    addMessage({
      id: `cancel-${Date.now()}`,
      role: 'assistant',
      content: 'בסדר, הפעולה בוטלה. יש משהו אחר שאוכל לעזור לך?',
      response: { type: 'info', message: '' },
      timestamp: new Date(),
      skipFromHistory: true,
    });
    setPendingAction(null);
  }, [addMessage]);

  return { messages, isLoading, pendingAction, sendMessage, sendAudio, confirmAction, cancelAction };
}
