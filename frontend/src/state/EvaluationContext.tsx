import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

export interface EvaluationRecord {
  id: string;
  productId: string;
  relevant: boolean;
  timestamp: number;
  score?: number;
  searchId?: string;
  rank?: number;
}

interface EvaluationContextValue {
  records: EvaluationRecord[];
  addRecord: (record: Omit<EvaluationRecord, "id" | "timestamp">) => void;
}

const EvaluationContext = createContext<EvaluationContextValue | undefined>(
  undefined
);

export function EvaluationProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<EvaluationRecord[]>([]);

  const addRecord: EvaluationContextValue["addRecord"] = (record) => {
    setRecords((prev) => [
      ...prev,
      {
        ...record,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      },
    ]);
  };

  return (
    <EvaluationContext.Provider value={{ records, addRecord }}>
      {children}
    </EvaluationContext.Provider>
  );
}

export function useEvaluation(): EvaluationContextValue {
  const ctx = useContext(EvaluationContext);
  if (!ctx) {
    throw new Error("useEvaluation must be used within EvaluationProvider");
  }
  return ctx;
}

