import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

export interface ApiKeys {
  openai?: string;
  anthropic?: string;
  google?: string;
  embedding?: string;
}

interface ApiKeysContextValue {
  apiKeys: ApiKeys;
  setApiKey: (provider: keyof ApiKeys, key: string) => void;
  getApiKey: (provider: keyof ApiKeys) => string | undefined;
}

const ApiKeysContext = createContext<ApiKeysContextValue | undefined>(undefined);

export function ApiKeysProvider({ children }: { children: ReactNode }) {
  const [apiKeys, setApiKeys] = useState<ApiKeys>({});

  const setApiKey = (provider: keyof ApiKeys, key: string) => {
    setApiKeys((prev) => ({
      ...prev,
      [provider]: key.trim() || undefined,
    }));
  };

  const getApiKey = (provider: keyof ApiKeys) => {
    return apiKeys[provider];
  };

  return (
    <ApiKeysContext.Provider value={{ apiKeys, setApiKey, getApiKey }}>
      {children}
    </ApiKeysContext.Provider>
  );
}

export function useApiKeys(): ApiKeysContextValue {
  const ctx = useContext(ApiKeysContext);
  if (!ctx) {
    throw new Error("useApiKeys must be used within ApiKeysProvider");
  }
  return ctx;
}
