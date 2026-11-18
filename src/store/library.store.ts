import { create } from 'zustand';
import type { IContent } from '../types/content';

export interface LibraryFilters {
  board?: string[];
  medium?: string[];
  gradeLevel?: string[];
  subject?: string[];
  primaryCategory?: string[];
  questionType?: string[];
}

interface LibraryState {
  allContent: IContent[];
  filteredContent: IContent[];
  /** Questions without the set's skills, shown collapsed under the matching ones (one page). */
  allOtherContent: IContent[];
  otherContent: IContent[];
  searchQuery: string;
  activeFilter: string;
  advancedFilters: LibraryFilters;
  isLoading: boolean;
  totalCount: number;
  offset: number;
  sortAZ: boolean;
  setContent: (content: IContent[], total: number, rawCount: number) => void;
  setOtherContent: (content: IContent[]) => void;
  appendContent: (content: IContent[], total: number, rawCount: number) => void;
  setFilter: (filter: string) => void;
  setSearch: (query: string) => void;
  setLoading: (loading: boolean) => void;
  setAdvancedFilters: (filters: LibraryFilters) => void;
  setOffset: (offset: number) => void;
  setSortAZ: (sortAZ: boolean) => void;
  applyFilter: () => void;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  allContent: [],
  filteredContent: [],
  allOtherContent: [],
  otherContent: [],
  searchQuery: '',
  activeFilter: 'all',
  advancedFilters: {},
  isLoading: false,
  totalCount: 0,
  offset: 0,
  sortAZ: false,

  setContent: (content, total, rawCount) => {
    set({ allContent: content, totalCount: total, offset: rawCount });
    get().applyFilter();
  },

  setOtherContent: (content) => {
    set({ allOtherContent: content });
    get().applyFilter();
  },

  appendContent: (content, total, rawCount) => {
    const merged = [...get().allContent, ...content];
    set((state) => ({ allContent: merged, totalCount: total, offset: state.offset + rawCount }));
    get().applyFilter();
  },

  setFilter: (filter) => {
    set({ activeFilter: filter });
    get().applyFilter();
  },

  setSearch: (query) => {
    set({ searchQuery: query });
    get().applyFilter();
  },

  setLoading: (loading) => set({ isLoading: loading }),
  setAdvancedFilters: (filters) => set({ advancedFilters: filters }),
  setOffset: (offset) => set({ offset }),
  setSortAZ: (sortAZ) => set({ sortAZ }),

  applyFilter: () => {
    const { allContent, allOtherContent, activeFilter, searchQuery } = get();
    set({
      filteredContent: filterItems(allContent, activeFilter, searchQuery),
      otherContent: filterItems(allOtherContent, activeFilter, searchQuery),
    });
  },
}));

/** The type chip and the name search, applied the same way to both lists. */
function filterItems(items: IContent[], activeFilter: string, searchQuery: string): IContent[] {
  let filtered = items;

  if (activeFilter && activeFilter !== 'all') {
    const filterLower = activeFilter.toLowerCase();
    filtered = filtered.filter((item) =>
      [item.mimeType ?? '', item.primaryCategory ?? '', item.contentType ?? '']
        .join(' ').toLowerCase().includes(filterLower),
    );
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter((item) => (item.name ?? '').toLowerCase().includes(q));
  }

  return filtered;
}
