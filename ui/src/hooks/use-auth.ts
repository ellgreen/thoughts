import { User } from "@/types";
import { createContext, useContext } from "react";

export interface AuthContext {
  isAuthenticated: boolean;
  login: (name: string) => Promise<void>;
  logout: () => Promise<void>;
  user: User | null;
}

export const AuthContext = createContext<AuthContext | null>(null);

const nameKeyName = "thoughts.auth.user.name";
const aiKeyName = "thoughts.auth.user.ai_enabled";

export function getStoredUser(): User | null {
  const name = localStorage.getItem(nameKeyName);
  const ai_enabled = JSON.parse(localStorage.getItem(aiKeyName) ?? "false");

  if (name) {
    return { name, ai_enabled };
  }

  return null;
}

export function setStoredUser(user: User | null) {
  if (user) {
    localStorage.setItem(nameKeyName, user.name);
    localStorage.setItem(aiKeyName, JSON.stringify(user.ai_enabled));
  } else {
    localStorage.removeItem(nameKeyName);
    localStorage.removeItem(aiKeyName);
  }
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return ctx;
}
