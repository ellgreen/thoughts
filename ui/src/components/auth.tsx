import {
  AuthContext,
  AuthStatus,
  getStoredUser,
  setStoredUser,
} from "@/hooks/use-auth";
import { api, setSessionExpiredHandler } from "@/lib/api";
import { User } from "@/types";
import { useCallback, useEffect, useState } from "react";

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [status, setStatus] = useState<AuthStatus>("pending");

  const clearSession = useCallback(() => {
    setStoredUser(null);
    setUser(null);
    setStatus("anonymous");
  }, []);

  const login = useCallback(async (name: string) => {
    const res = await api.post<User>("/api/auth/login", { name });

    setStoredUser(res.data);
    setUser(res.data);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    await api.post("/api/auth/logout").catch(() => {});

    clearSession();
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;

    api
      .get<User>("/api/auth/self")
      .then((res) => {
        if (cancelled) return;

        setStoredUser(res.data);
        setUser(res.data);
        setStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;

        clearSession();
      });

    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  useEffect(() => {
    setSessionExpiredHandler(clearSession);

    return () => setSessionExpiredHandler(() => {});
  }, [clearSession]);

  return (
    <AuthContext.Provider
      value={{
        status,
        isAuthenticated: status === "authenticated",
        user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
