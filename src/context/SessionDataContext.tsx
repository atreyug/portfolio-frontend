/**
 * Privacy-first session store.
 *
 * Analysis requests/responses live ONLY in React state (application memory).
 * Nothing here is written to localStorage, sessionStorage, IndexedDB or the
 * URL. Everything is cleared on logout and when the tab closes.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export interface AnalysisRecord {
  request: unknown;
  response: unknown;
  at: string; // ISO timestamp
}

type AnalysisKind = "stock" | "mutualFund" | "projection" | "monitoring";

interface SessionDataValue {
  stock?: AnalysisRecord;
  mutualFund?: AnalysisRecord;
  projection?: AnalysisRecord;
  monitoring?: AnalysisRecord;
  analysesRun: number;
  record: (kind: AnalysisKind, request: unknown, response: unknown) => void;
  clearAll: () => void;
}

const SessionDataContext = createContext<SessionDataValue | null>(null);

export function useSessionData(): SessionDataValue {
  const ctx = useContext(SessionDataContext);
  if (!ctx) throw new Error("useSessionData must be used inside <SessionDataProvider>");
  return ctx;
}

export function SessionDataProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Partial<Record<AnalysisKind, AnalysisRecord>>>({});
  const [analysesRun, setAnalysesRun] = useState(0);

  const record = useCallback((kind: AnalysisKind, request: unknown, response: unknown) => {
    setEntries((prev) => ({ ...prev, [kind]: { request, response, at: new Date().toISOString() } }));
    if (kind !== "monitoring") setAnalysesRun((n) => n + 1);
  }, []);

  const clearAll = useCallback(() => {
    setEntries({});
    setAnalysesRun(0);
  }, []);

  const value = useMemo<SessionDataValue>(
    () => ({ ...entries, analysesRun, record, clearAll }),
    [entries, analysesRun, record, clearAll],
  );

  return <SessionDataContext.Provider value={value}>{children}</SessionDataContext.Provider>;
}
