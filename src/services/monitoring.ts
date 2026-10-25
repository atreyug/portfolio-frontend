import { api } from "./client";
import type { MonitoringCheckRequest, MonitoringRunRequest } from "@/types/api";

export async function runMonitoringCheck(payload: MonitoringCheckRequest): Promise<unknown> {
  const { data } = await api.post("/api/monitoring/check", payload);
  return data as unknown;
}

export async function runMonitoringSweep(payload: MonitoringRunRequest = {}): Promise<unknown> {
  const { data } = await api.post("/api/monitoring/run", payload);
  return data as unknown;
}
