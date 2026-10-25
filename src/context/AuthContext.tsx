import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  refreshAccessToken,
  setSessionExpiredListener,
  tokenStore,
  normalizeApiError,
} from "@/services/client";
import * as authService from "@/services/auth";
import { getMyProfile } from "@/services/managers";
import type { ManagerProfile, SignupRequest } from "@/types/api";
import { useToast } from "@/context/ToastContext";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  manager: ManagerProfile | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: SignupRequest) => Promise<void>;
  logout: (reason?: string) => void;
  reloadManager: () => Promise<void>;
  setManager: (m: ManagerProfile) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [manager, setManager] = useState<ManagerProfile | null>(null);
  const toast = useToast();

  const loadManager = useCallback(async () => {
    const profile = await getMyProfile();
    setManager(profile);
  }, []);

  /* Restore session from a persisted refresh token on first load. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tokenStore.getRefresh()) {
        setStatus("unauthenticated");
        return;
      }
      const fresh = await refreshAccessToken();
      if (!fresh) {
        if (!cancelled) setStatus("unauthenticated");
        return;
      }
      try {
        await loadManager();
        if (!cancelled) setStatus("authenticated");
      } catch {
        tokenStore.clear();
        if (!cancelled) setStatus("unauthenticated");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadManager]);

  /* React to hard session expiry bubbling out of the Axios layer. */
  useEffect(() => {
    setSessionExpiredListener(() => {
      setManager(null);
      setStatus((prev) => {
        if (prev === "authenticated") {
          toast.info("Session expired", "Please sign in again to continue.");
        }
        return "unauthenticated";
      });
    });
    return () => setSessionExpiredListener(null);
  }, [toast]);

  const login = useCallback(
    async (email: string, password: string) => {
      const tokens = await authService.login({ email, username: email, password });
      if (!tokens.accessToken) {
        throw normalizeApiError(new Error("The response did not include an access token."));
      }
      tokenStore.setAccess(tokens.accessToken);
      if (tokens.refreshToken) tokenStore.setRefresh(tokens.refreshToken);
      try {
        await loadManager();
      } catch {
        /* Profile endpoint may be slow — don't block the sign-in. */
      }
      setStatus("authenticated");
    },
    [loadManager],
  );

  const signup = useCallback(
    async (input: SignupRequest) => {
      const result = await authService.signup(input);
      if (result.accessToken) {
        tokenStore.setAccess(result.accessToken);
        if (result.refreshToken) tokenStore.setRefresh(result.refreshToken);
        try {
          await loadManager();
        } catch {
          /* non-blocking */
        }
        setStatus("authenticated");
        return;
      }
      /* Signup succeeded but issued no tokens — sign in with the new credentials. */
      await login(input.email, input.password);
    },
    [loadManager, login],
  );

  const logout = useCallback((_reason?: string) => {
    tokenStore.clear();
    setManager(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      manager,
      login,
      signup,
      logout,
      reloadManager: loadManager,
      setManager,
    }),
    [status, manager, login, signup, logout, loadManager],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
