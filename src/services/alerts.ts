import { api } from "./client";

export async function getAlerts(unreadOnly = false): Promise<unknown> {
  const { data } = await api.get("/api/alerts", { params: { unread_only: unreadOnly } });
  return data as unknown;
}

export async function markAlertRead(alertId: string | number): Promise<unknown> {
  const { data } = await api.patch(`/api/alerts/${encodeURIComponent(String(alertId))}/read`);
  return data as unknown;
}
