import axios from "axios";
import { toast } from "sonner";

export const api = axios.create({
  withCredentials: true,
  baseURL: import.meta.env.DEV ? "http://localhost:3000" : undefined,
});

/** Endpoints where a 401 is a normal answer, not an expired session. */
const authEndpoints = ["/api/auth/self", "/api/auth/login"];

type SessionExpiredHandler = () => void;

let onSessionExpired: SessionExpiredHandler = () => {};

/**
 * Registered by the auth provider. The interceptor cannot redirect on its own:
 * a thrown router redirect is only caught inside a loader, so from a plain
 * component effect it becomes a swallowed rejection while still having wiped
 * the stored user on the way past.
 */
export function setSessionExpiredHandler(handler: SessionExpiredHandler) {
  onSessionExpired = handler;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url: string = error.config?.url ?? "";

    if (status === 400) {
      toast("There was a problem with the request", {
        description: error.response.data,
      });

      return Promise.reject(error);
    }

    if (status === 401 && !authEndpoints.some((path) => url.startsWith(path))) {
      // The cookie is gone or no longer valid. Tell the auth layer and let the
      // router decide where to send people.
      onSessionExpired();
    }

    return Promise.reject(error);
  },
);
