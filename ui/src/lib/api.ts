import { setStoredUser } from "@/hooks/use-auth";
import { redirect } from "@tanstack/react-router";
import axios from "axios";
import { toast } from "sonner";

export const api = axios.create({
  withCredentials: true,
  baseURL: import.meta.env.DEV ? "http://localhost:3000" : undefined,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 400) {
      toast("There was a problem with the request", {
        description: error.response.data,
      });

      return Promise.reject(error);
    }

    if (error.response?.status === 401) {
      setStoredUser(null);

      throw redirect({ to: "/login" });
    }

    return Promise.reject(error);
  },
);
