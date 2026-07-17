import { useState } from 'react';
import { Header } from './components/Header';
import { InventoryPage } from './components/InventoryPage';
import { PricesPage } from './components/PricesPage';
import { ConfirmationModal } from './components/ConfirmationModal';
import { TripPage } from './components/TripPage';
import { VoiceAssistant } from './components/VoiceAssistant';
import { useInventory } from './hooks/useInventory';
import { useChat } from './hooks/useChat';
import { useShuk } from './hooks/useShuk';

type AppPage = 'inventory' | 'prices' | 'trip';

export default function App() {
  const [page, setPage] = useState<AppPage>('inventory');

  const {
    products, status, error, reload,
    applyAction, updateProductPrice, updateProductMeta, updateProductQuantity,
    subtractQuantity, addProduct, deleteProduct,
  } = useInventory();

  const { messages, isLoading, pendingAction, sendMessage, confirmAction, cancelAction } = useChat({
    products,
    onInventoryAction: applyAction,
  });

  const {
    shuk, history,
    startShuk, cancelShuk, addItem, removeItem,
    updateQuantityTaken, updateQuantitySold,
    goToReporting, goToPreparing, completeShuk,
  } = useShuk();

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden" dir="rtl">
      <Header
        page={page}
        onPageChange={setPage}
        hasActiveShuk={shuk !== null}
      />

      {/* Connection error banner */}
      {status === 'error' && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-red-700 text-sm">
            <span>⚠️</span>
            <span>לא ניתן להתחבר לשרת הנתונים: {error}</span>
          </div>
          <button
            onClick={reload}
            className="text-xs bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700"
          >
            נסה שוב
          </button>
        </div>
      )}

      {/* Loading overlay */}
      {status === 'loading' && products.length === 0 && (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500 text-sm">טוען מלאי מהמאגר...</p>
          </div>
        </div>
      )}

      <div className={`flex flex-1 overflow-hidden ${status === 'loading' && products.length === 0 ? 'hidden' : ''}`}>
        {page === 'inventory' ? (
          <div className="flex-1 overflow-hidden">
            <InventoryPage
              products={products}
              onUpdatePrice={updateProductPrice}
              onUpdateMeta={updateProductMeta}
              onUpdateQuantity={updateProductQuantity}
              onAddProduct={addProduct}
              onDeleteProduct={deleteProduct}
            />
          </div>
        ) : page === 'prices' ? (
          <div className="flex-1 overflow-hidden">
            <PricesPage
              products={products}
              onUpdatePrice={updateProductPrice}
              onUpdateMeta={updateProductMeta}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <TripPage
              products={products}
              shuk={shuk}
              history={history}
              onStartShuk={() => startShuk(products)}
              onCancelShuk={cancelShuk}
              onAddItem={addItem}
              onRemoveItem={removeItem}
              onUpdateQuantityTaken={updateQuantityTaken}
              onUpdateQuantitySold={updateQuantitySold}
              onGoToReporting={goToReporting}
              onGoToPreparing={goToPreparing}
              onCompleteShuk={() => completeShuk(subtractQuantity)}
            />
          </div>
        )}
      </div>

      {/* Voice Assistant — always accessible */}
      <VoiceAssistant
        messages={messages}
        isLoading={isLoading}
        onSendMessage={sendMessage}
      />

      {pendingAction && (
        <ConfirmationModal
          action={pendingAction.action}
          onConfirm={confirmAction}
          onCancel={cancelAction}
        />
      )}
    </div>
  );
}
