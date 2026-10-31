import { createContext, useContext, useEffect, useState } from "react";

import { api, clearSession, getStoredUser, setSession } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem("morrow_access");

    if (!token) {
      setReady(true);
      return undefined;
    }

    api("/auth/me/")
      .then((me) => {
        if (active) {
          setUser(me);
          localStorage.setItem("morrow_user", JSON.stringify(me));
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
    window.addEventListener("morrow:unauthorized", onUnauthorized);
    return () => window.removeEventListener("morrow:unauthorized", onUnauthorized);
  }, []);

  async function login(username, password) {
    const data = await api("/auth/login/", {
      method: "POST",
      body: { username, password },
      auth: false,
    });
    setSession(data);
    setUser(data.user);
    return data.user;
  }

  async function register(username, email, password) {
    const data = await api("/auth/register/", {
      method: "POST",
      body: { username, email, password },
      auth: false,
    });
    setSession(data);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    clearSession();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
