import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

export interface SearchConfig {
  maxCandidates: number;
  topK: number;
  minScore: number;
  imageWeight: number;
  textWeight: number;
  priceProximityWeight: number;
  backendUrl: string;
  priceRangeEnabled: boolean;
  priceRangeMin: number;
  priceRangeMax: number;
  aiProvider: string;
  aiModel: string;
  embeddingProvider?: string;
  embeddingModel?: string;
}

interface SearchConfigContextValue {
  config: SearchConfig;
  setConfig: (next: SearchConfig) => void;
}

const defaultConfig: SearchConfig = {
  maxCandidates: 200,
  topK: 20,
  minScore: 0.2,
  imageWeight: 0.6,
  textWeight: 0.25,
  priceProximityWeight: 0.15,
  backendUrl: "http://localhost:4000",
  priceRangeEnabled: false,
  priceRangeMin: 0,
  priceRangeMax: 10000,
  aiProvider: "openai",
  aiModel: "gpt-4o",
};

const SearchConfigContext = createContext<SearchConfigContextValue | undefined>(
  undefined
);

export function SearchConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SearchConfig>(defaultConfig);

  return (
    <SearchConfigContext.Provider value={{ config, setConfig }}>
      {children}
    </SearchConfigContext.Provider>
  );
}

export function useSearchConfig(): SearchConfigContextValue {
  const ctx = useContext(SearchConfigContext);
  if (!ctx) {
    throw new Error("useSearchConfig must be used within SearchConfigProvider");
  }
  return ctx;
}
