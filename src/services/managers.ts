import { api } from "./client";
import type { ChangePasswordRequest, ManagerProfile, UpdateManagerRequest } from "@/types/api";

export async function getMyProfile(): Promise<ManagerProfile> {
  const { data } = await api.get("/managers/me");
  return data as ManagerProfile;
}

export async function updateMyProfile(payload: UpdateManagerRequest): Promise<ManagerProfile> {
  const { data } = await api.put("/managers/me", payload);
  return data as ManagerProfile;
}

export async function changeMyPassword(payload: ChangePasswordRequest): Promise<unknown> {
  const { data } = await api.put("/managers/me/password", payload);
  return data as unknown;
}

export async function deleteMyAccount(password?: string): Promise<unknown> {
  const { data } = await api.delete("/managers/me", password ? { data: { password } } : undefined);
  return data as unknown;
}
