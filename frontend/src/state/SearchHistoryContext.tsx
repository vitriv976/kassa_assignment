import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

export interface ScoredProduct {
  product: {
    _id: string;
    title: string;
    description: string;
    category: string;
    type: string;
    price: number;
    width: number;
    height: number;
    depth: number;
  };
  score: number;
  explanation?: string;
}

export interface SearchHistoryItem {
  id: string;
  queryText?: string;
  imagePreview?: string;
  imageBase64?: string;
  results: ScoredProduct[];
  resultsCount: number;
  isFurniture?: boolean;
  rejectionReason?: string;
  timestamp: number;
}

interface SearchHistoryContextValue {
  history: SearchHistoryItem[];
  addHistory: (item: Omit<SearchHistoryItem, "id" | "timestamp">) => void;
  clearHistory: () => void;
}

const SearchHistoryContext = createContext<SearchHistoryContextValue | undefined>(
  undefined
);

export function SearchHistoryProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);

  const addHistory = (item: Omit<SearchHistoryItem, "id" | "timestamp">) => {
    setHistory((prev) => [
      {
        ...item,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      },
      ...prev.slice(0, 9), // Keep last 10 searches
    ]);
  };

  const clearHistory = () => {
    setHistory([]);
  };

  return (
    <SearchHistoryContext.Provider value={{ history, addHistory, clearHistory }}>
      {children}
    </SearchHistoryContext.Provider>
  );
}

export function useSearchHistory(): SearchHistoryContextValue {
  const ctx = useContext(SearchHistoryContext);
  if (!ctx) {
    throw new Error("useSearchHistory must be used within SearchHistoryProvider");
  }
  return ctx;
}
