import { AuthContext, getStoredUser, setStoredUser } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { User } from "@/types";
import { useCallback, useEffect, useState } from "react";

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(getStoredUser());

  const isAuthenticated = !!user;

  const logout = useCallback(async () => {
    await api.post("/api/auth/logout");

    setStoredUser(null);
    setUser(null);
  }, []);

  const login = useCallback(async (name: string) => {
    const res = await api.post<User>("/api/auth/login", { name });

    if (res && res.status === 200) {
      setStoredUser(res.data);
      setUser(res.data);
    }
  }, []);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
