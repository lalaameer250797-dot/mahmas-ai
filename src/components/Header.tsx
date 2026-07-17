type AppPage = 'inventory' | 'prices' | 'trip';

interface HeaderProps {
  page: AppPage;
  onPageChange: (p: AppPage) => void;
  hasActiveTrip: boolean;
}

export function Header({ page, onPageChange, hasActiveTrip }: HeaderProps) {
  return (
    <header className="bg-gradient-to-l from-blue-700 to-blue-800 text-white flex-shrink-0 shadow-lg">
      {/* Top row */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-lg">
            🏪
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight">מחסן חכם</h1>
            <p className="text-blue-200 text-[11px]">ניהול מלאי חכם בעברית</p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-t border-white/10">
        <TabBtn
          active={page === 'inventory'}
          onClick={() => onPageChange('inventory')}
          icon="📦"
          label="מלאי"
        />
        <TabBtn
          active={page === 'prices'}
          onClick={() => onPageChange('prices')}
          icon="💰"
          label="מחירים"
        />
        <TabBtn
          active={page === 'trip'}
          onClick={() => onPageChange('trip')}
          icon="🛒"
          label="יום שוק"
          badge={hasActiveTrip}
        />
      </div>
    </header>
  );
}

function TabBtn({
  active, onClick, icon, label, badge,
}: {
  active: boolean; onClick: () => void; icon: string; label: string; badge?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs sm:text-sm font-medium transition-colors ${
        active
          ? 'bg-white/15 border-b-2 border-white text-white'
          : 'text-blue-200 hover:bg-white/10 hover:text-white border-b-2 border-transparent'
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
      {badge && !active && (
        <span className="absolute top-1.5 left-1/2 -translate-x-8 w-2 h-2 bg-amber-400 rounded-full" />
      )}
    </button>
  );
}
