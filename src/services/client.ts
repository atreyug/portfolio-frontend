/**
 * Centralized Axios client.
 *
 * Auth strategy (privacy-first):
 *  - The short-lived access token lives ONLY in module memory — never in
 *    localStorage/sessionStorage — and is attached as a Bearer header.
 *  - If the backend issues a refresh token (and does not provide an
 *    HttpOnly cookie flow), the refresh token is kept in localStorage so a
 *    session can survive a page reload. This is documented in the README;
 *    an HttpOnly-cookie refresh flow is the preferred hardening.
 *  - On a 401 the client attempts a single-flight refresh, replays the
 *    original request, and only then treats the session as expired.
 */
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { isRecord } from "@/utils/payload";
import type { AuthTokens, RefreshRequest } from "@/types/api";

export const API_BASE_URL = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000"
).replace(/\/+$/, "");

const REFRESH_STORAGE_KEY = "mrdn.refresh-token";

let accessToken: string | null = null;

function readRefresh(): string | null {
  try {
    return window.localStorage.getItem(REFRESH_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeRefresh(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(REFRESH_STORAGE_KEY, token);
    else window.localStorage.removeItem(REFRESH_STORAGE_KEY);
  } catch {
    /* storage unavailable (private mode) — session simply won't persist */
  }
}

export const tokenStore = {
  getAccess: (): string | null => accessToken,
  setAccess: (token: string | null): void => {
    accessToken = token;
  },
  getRefresh: readRefresh,
  setRefresh: writeRefresh,
  clear: (): void => {
    accessToken = null;
    writeRefresh(null);
  },
};

/* ------------------------------- ApiError -------------------------------- */

export class ApiError extends Error {
  status?: number;
  details?: string[];
  constructor(message: string, status?: number, details?: string[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export function normalizeApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      return new ApiError(
        `Unable to reach the API at ${API_BASE_URL}. Confirm the backend is running and that CORS allows this origin.`,
      );
    }
    const { status, data } = err.response;
    const details: string[] = [];
    let message: string | undefined;
    const body: unknown = data;
    if (isRecord(body)) {
      const detail = body.detail;
      if (typeof detail === "string" && detail.trim()) message = detail;
      else if (Array.isArray(detail)) {
        for (const item of detail) {
          if (isRecord(item)) {
            const loc = Array.isArray(item.loc)
              ? item.loc.filter((l) => l !== "body" && l !== "query").join(".")
              : "";
            const msg = typeof item.msg === "string" ? item.msg : "Invalid value.";
            details.push(loc ? `${loc}: ${msg}` : msg);
          } else if (typeof item === "string") details.push(item);
        }
        message = "Some fields need attention.";
      } else if (typeof body.message === "string") message = body.message;
      else if (typeof body.error === "string") message = body.error;
    } else if (typeof body === "string" && body.trim()) {
      message = body;
    }
    if (!message) {
      if (status === 401) message = "Your session has expired. Please sign in again.";
      else if (status === 403) message = "You don't have permission to perform this action.";
      else if (status === 404) message = "The requested resource was not found.";
      else if (status === 422) message = "The request was rejected by the server.";
      else if (status === 429) message = "Too many requests — please wait a moment and retry.";
      else if (status >= 500) message = "The server hit an unexpected error. Please try again.";
      else message = `Request failed with status ${status}.`;
    }
    return new ApiError(message, status, details.length ? details : undefined);
  }
  return new ApiError(err instanceof Error ? err.message : "Something went wrong.");
}

/* ------------------------------ Token extract ---------------------------- */

export function extractTokens(payload: unknown): AuthTokens {
  const names = {
    access: ["access_token", "accessToken", "access", "token", "jwt"],
    refresh: ["refresh_token", "refreshToken", "refresh"],
  };
  const layers: unknown[] = [payload];
  if (isRecord(payload)) {
    if (isRecord(payload.data)) layers.push(payload.data);
    if (isRecord(payload.tokens)) layers.push(payload.tokens);
    if (isRecord(payload.token)) layers.push(payload.token);
    if (isRecord(payload.auth)) layers.push(payload.auth);
  }
  const grab = (keys: string[]): string | null => {
    for (const layer of layers) {
      if (!isRecord(layer)) continue;
      for (const key of keys) {
        const v = layer[key];
        if (typeof v === "string" && v) return v;
      }
    }
    return null;
  };
  return { accessToken: grab(names.access), refreshToken: grab(names.refresh) };
}

/* ------------------------------ Axios client ----------------------------- */

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45000,
  headers: { "Content-Type": "application/json" },
});

const AUTH_PATH_RE = /(^|\/)auth(\/|$)/;

function attachBearer(config: InternalAxiosRequestConfig, token: string): void {
  if (config.headers && typeof (config.headers as { set?: unknown }).set === "function") {
    (config.headers as { set: (k: string, v: string) => void }).set("Authorization", `Bearer ${token}`);
  }
}

api.interceptors.request.use((config) => {
  const token = tokenStore.getAccess();
  if (token && !AUTH_PATH_RE.test(config.url ?? "")) attachBearer(config, token);
  return config;
});

/* Single-flight refresh so concurrent 401s share one refresh call. */
let refreshInFlight: Promise<string | null> | null = null;

export function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refresh = tokenStore.getRefresh();
      if (!refresh) return null;
      try {
        const body: RefreshRequest = { refresh_token: refresh };
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, body, {
          headers: { "Content-Type": "application/json" },
          timeout: 20000,
        });
        const tokens = extractTokens(data);
        if (!tokens.accessToken) return null;
        tokenStore.setAccess(tokens.accessToken);
        if (tokens.refreshToken) tokenStore.setRefresh(tokens.refreshToken);
        return tokens.accessToken;
      } catch {
        tokenStore.clear();
        return null;
      } finally {
        // Allow a future refresh once this one settles.
        setTimeout(() => {
          refreshInFlight = null;
        }, 0);
      }
    })();
  }
  return refreshInFlight;
}

type SessionExpiredListener = () => void;
let sessionExpiredListener: SessionExpiredListener | null = null;
export function setSessionExpiredListener(fn: SessionExpiredListener | null): void {
  sessionExpiredListener = fn;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const config = error.config as (InternalAxiosRequestConfig & { _retriedAfterRefresh?: boolean }) | undefined;
    const isAuthCall = AUTH_PATH_RE.test(config?.url ?? "");

    if (status === 401 && config && !config._retriedAfterRefresh && !isAuthCall && tokenStore.getRefresh()) {
      const fresh = await refreshAccessToken();
      if (fresh) {
        config._retriedAfterRefresh = true;
        attachBearer(config, fresh);
        try {
          return await api(config);
        } catch (retryErr) {
          return Promise.reject(normalizeApiError(retryErr));
        }
      }
    }

    if (status === 401 && !isAuthCall) {
      tokenStore.clear();
      sessionExpiredListener?.();
    }
    return Promise.reject(normalizeApiError(error));
  },
);
