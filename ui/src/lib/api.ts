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
 * Registered by the auth provider. The interceptor cannot redirect itself: a
 * thrown router redirect is only caught inside a loader.
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
      onSessionExpired();
    }

    return Promise.reject(error);
  },
);
