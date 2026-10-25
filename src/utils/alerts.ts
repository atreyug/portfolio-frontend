import { findRecordsArray, isRecord, recordFind } from "@/utils/payload";
import { titleCase } from "@/utils/format";

export interface AlertView {
  id?: string | number;
  title: string;
  message?: string;
  severity?: string;
  symbol?: string;
  timestamp?: string;
  /** undefined when the backend doesn't expose a read flag */
  read?: boolean;
  raw: Record<string, unknown>;
}

function pickString(rec: Record<string, unknown>, keys: string[]): string | undefined {
  const v = recordFind(rec, keys);
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number") return String(v);
  return undefined;
}

export function normalizeAlerts(data: unknown): AlertView[] {
  const recs = Array.isArray(data)
    ? data.filter(isRecord)
    : findRecordsArray(data, ["alerts", "items", "results", "data", "records"]) ?? [];
  return recs.map((rec) => {
    const idRaw = recordFind(rec, ["id", "alert_id", "alertid", "uuid"]);
    const readRaw = recordFind(rec, ["is_read", "isread", "read", "seen"]);
    const readAt = recordFind(rec, ["read_at", "readat"]);
    const title =
      pickString(rec, ["title", "subject", "name", "alert_title", "heading"]) ??
      (pickString(rec, ["alert_type", "type", "category"]) ? titleCase(pickString(rec, ["alert_type", "type", "category"])!) : undefined) ??
      "Alert";
    return {
      id: typeof idRaw === "string" || typeof idRaw === "number" ? idRaw : undefined,
      title,
      message: pickString(rec, ["message", "description", "body", "detail", "text"]),
      severity: pickString(rec, ["severity", "priority", "level"]),
      symbol: pickString(rec, ["symbol", "holding", "ticker", "scheme_name", "security"]),
      timestamp: pickString(rec, ["created_at", "createdat", "timestamp", "time", "date", "triggered_at", "generated_at"]),
      read: typeof readRaw === "boolean" ? readRaw : readAt ? true : undefined,
      raw: rec,
    };
  });
}
