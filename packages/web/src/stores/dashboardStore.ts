import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ViewMode = 'grid' | 'list';
type SortField = 'created_at' | 'updated_at' | 'title' | 'view_count';
type SortOrder = 'asc' | 'desc';

interface DashboardStore {
  // View preferences (persisted to localStorage)
  view: ViewMode;
  sort: SortField;
  order: SortOrder;

  // Search (not persisted)
  search: string;

  // Multi-select state
  selectedIds: Set<string>;
  isSelecting: boolean;

  // Actions
  setView: (view: ViewMode) => void;
  setSort: (sort: SortField, order: SortOrder) => void;
  setSearch: (search: string) => void;

  toggleSelect: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  setSelecting: (isSelecting: boolean) => void;
}

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set, get) => ({
      // View preferences
      view: 'grid',
      sort: 'updated_at',
      order: 'desc',

      // Search
      search: '',

      // Selection state
      selectedIds: new Set(),
      isSelecting: false,

      // Actions
      setView: (view) => set({ view }),

      setSort: (sort, order) => set({ sort, order }),

      setSearch: (search) => set({ search }),

      toggleSelect: (id) => {
        const { selectedIds } = get();
        const newSelectedIds = new Set(selectedIds);
        if (newSelectedIds.has(id)) {
          newSelectedIds.delete(id);
        } else {
          newSelectedIds.add(id);
        }
        set({
          selectedIds: newSelectedIds,
          isSelecting: newSelectedIds.size > 0,
        });
      },

      selectAll: (ids) => {
        set({
          selectedIds: new Set(ids),
          isSelecting: ids.length > 0,
        });
      },

      clearSelection: () => {
        set({
          selectedIds: new Set(),
          isSelecting: false,
        });
      },

      setSelecting: (isSelecting) => set({ isSelecting }),
    }),
    {
      name: 'dashboard-preferences',
      partialize: (state) => ({
        view: state.view,
        sort: state.sort,
        order: state.order,
      }),
    }
  )
);
