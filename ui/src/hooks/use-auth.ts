import { User } from "@/types";
import { createContext, useContext } from "react";

/**
 * "pending" until the server has confirmed whether the session cookie is still
 * good. Nothing may decide what to render until it resolves.
 */
export type AuthStatus = "pending" | "authenticated" | "anonymous";

export interface AuthContext {
  status: AuthStatus;
  isAuthenticated: boolean;
  login: (name: string) => Promise<void>;
  logout: () => Promise<void>;
  user: User | null;
}

export const AuthContext = createContext<AuthContext | null>(null);

const nameKeyName = "thoughts.auth.user.name";
const aiKeyName = "thoughts.auth.user.ai_enabled";

/**
 * Cached so the nav can show a name on first paint. This is a convenience
 * cache, never proof of anything: the session cookie is the only credential,
 * and it can expire or be invalidated without the browser telling us.
 */
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
