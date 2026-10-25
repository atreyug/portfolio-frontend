import { api, extractTokens, normalizeApiError, ApiError } from "./client";
import type { AuthTokens, LoginRequest, SignupRequest } from "@/types/api";

/**
 * Login: the spec supports `POST /auth/login` and the alias `POST /auth`.
 * We try `/auth/login` first and fall back to the alias when it is absent.
 */
export async function login(credentials: LoginRequest): Promise<AuthTokens> {
  let response;
  try {
    response = await api.post("/auth/login", credentials);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      response = await api.post("/auth", credentials);
    } else {
      throw normalizeApiError(err);
    }
  }
  return extractTokens(response.data);
}

export async function signup(payload: SignupRequest): Promise<AuthTokens & { raw: unknown }> {
  const response = await api.post("/auth/signup", payload);
  return { ...extractTokens(response.data), raw: response.data };
}
