import { SocketEvent } from "@/events";
import { createContext, useContext, useEffect, useRef } from "react";
import { ReadyState } from "react-use-websocket";

export type SocketListener = (event: SocketEvent) => void;

type RetroSocketContextType = {
  send: (event: SocketEvent) => void;
  subscribe: (listener: SocketListener) => () => void;
};

export const RetroSocketContext = createContext<RetroSocketContextType | null>(
  null,
);

export const ReadyStateContext = createContext<number>(
  ReadyState.UNINSTANTIATED,
);

export function useRetroSocket() {
  const ctx = useContext(RetroSocketContext);

  if (!ctx)
    throw new Error("useRetroSocket must be used within a SocketProvider");

  return ctx;
}

export function useReadyState() {
  return useContext(ReadyStateContext);
}

export function useSocketEvent(listener: SocketListener) {
  const { subscribe } = useRetroSocket();
  const ref = useRef(listener);

  // Through a ref so callers can pass an inline handler without resubscribing
  // on every render.
  useEffect(() => {
    ref.current = listener;
  });

  useEffect(() => subscribe((event) => ref.current(event)), [subscribe]);
}
