import { User } from "@/types";
import { createContext, useContext } from "react";

export interface AuthContext {
  isAuthenticated: boolean;
  login: (name: string) => Promise<void>;
  logout: () => Promise<void>;
  user: User | null;
}

export const AuthContext = createContext<AuthContext | null>(null);

const keyName = "thoughts.auth.user.name";

export function getStoredUser(): User | null {
  const name = localStorage.getItem(keyName);

  if (name) {
    return { name };
  }

  return null;
}

export function setStoredUser(user: User | null) {
  if (user) {
    localStorage.setItem(keyName, user.name);
  } else {
    localStorage.removeItem(keyName);
  }
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return ctx;
}
