import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, clearSession, getStoredUser, hasSession, storeSession } from "./api";
import type { User } from "./types";

type AuthValue = {
  user: User | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

type TokenResponse = {
  access: string;
  refresh: string;
  user: User;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getStoredUser);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hasSession()) {
      setReady(true);
      return;
    }
    let active = true;
    api<User>("/auth/me/")
      .then((me) => {
        if (active) {
          setUser(me);
          storeSession({ user: me });
        }
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener("shelf:unauthorized", onUnauthorized);
    return () => window.removeEventListener("shelf:unauthorized", onUnauthorized);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const data = await api<TokenResponse>("/auth/token/", {
      method: "POST",
      body: { username, password },
      auth: false,
    });
    storeSession({ access: data.access, refresh: data.refresh, user: data.user });
    setUser(data.user);
  }, []);

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      await api("/auth/register/", {
        method: "POST",
        body: { username, email, password },
        auth: false,
      });
      await login(username, password);
    },
    [login],
  );

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, register, logout }),
    [user, ready, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
