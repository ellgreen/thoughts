import { Retro } from "@/types";
import { createContext, useContext } from "react";
import { WebSocketHook } from "react-use-websocket/dist/lib/types";

type RetroContextType = {
  retro: Retro;
  socket: WebSocketHook;
};

export const RetroContext = createContext<RetroContextType>(
  {} as RetroContextType,
);

export default function useRetro() {
  const ctx = useContext(RetroContext);

  if (ctx === undefined)
    throw new Error("useRetro must be used within a RetroContext");

  return ctx;
}
