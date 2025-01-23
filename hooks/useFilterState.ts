interface FilterState {
  make: string;
  model: string;
  condition: string;
  sort: string;
  search: string;
}
import { useState,useRef,useCallback } from "react";
export const useFilterState = (initialState: FilterState) => {
  const [filterState, setFilterState] = useState(initialState);
  const [pendingSearch, setPendingSearch] = useState('');

  // Cached filter values for comparison
  const prevFiltersRef = useRef(filterState);

  // Debounced filter application
  const applyFilters = useCallback((newFilters: Partial<FilterState>) => {
    setFilterState(current => {
      const updated = { ...current, ...newFilters };
      // Only update if filters actually changed
      if (JSON.stringify(updated) !== JSON.stringify(prevFiltersRef.current)) {
        prevFiltersRef.current = updated;
        return updated;
      }
      return current;
    });
  }, []);

  return {
    filterState,
    pendingSearch,
    setPendingSearch,
    applyFilters,
  };
};