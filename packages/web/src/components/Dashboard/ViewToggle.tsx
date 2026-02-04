import LayoutGrid from 'lucide-react/dist/esm/icons/layout-grid';
import List from 'lucide-react/dist/esm/icons/list';
import './ViewToggle.css';

type ViewMode = 'grid' | 'list';

interface ViewToggleProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="view-toggle">
      <button
        className={`view-toggle-btn ${view === 'grid' ? 'view-toggle-btn--active' : ''}`}
        onClick={() => onViewChange('grid')}
        aria-label="Grid view"
        title="Grid view"
      >
        <LayoutGrid size={16} />
      </button>
      <button
        className={`view-toggle-btn ${view === 'list' ? 'view-toggle-btn--active' : ''}`}
        onClick={() => onViewChange('list')}
        aria-label="List view"
        title="List view"
      >
        <List size={16} />
      </button>
    </div>
  );
}
