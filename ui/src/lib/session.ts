import { queryOptions } from "@tanstack/react-query";
import { api, ApiError } from "./api";

export type User = { id: string; name: string };
export type Me = { user: User; features: { gifSearch: boolean; ai: boolean } };

export type Field = { name: string; label: string; type: string; autocomplete?: string; help?: string };
export type Provider = { id: string; label: string; kind: "form" | "redirect"; fields?: Field[]; startUrl?: string };

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async (): Promise<Me | null> => {
    try {
      return await api<Me>("/api/me");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  },
  staleTime: Infinity,
});

export const providersQuery = queryOptions({
  queryKey: ["providers"],
  queryFn: () => api<{ providers: Provider[] }>("/api/auth/providers").then((r) => r.providers),
  staleTime: Infinity,
});

export const signIn = (provider: string, values: Record<string, string>) =>
  api<Me>(`/api/auth/${encodeURIComponent(provider)}`, { method: "POST", body: values });

export const signOut = () => api<void>("/api/auth/signout", { method: "POST" });

// safeRedirect keeps ?redirect= on this site, so a crafted link can't send
// someone elsewhere after they sign in.
export function safeRedirect(to: unknown): string {
  if (typeof to !== "string") return "/";
  try {
    const url = new URL(to, window.location.origin);
    if (url.origin !== window.location.origin) return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}
