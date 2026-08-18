import { SocketEvent } from "@/events";
import {
  ReadyStateContext,
  RetroSocketContext,
  SocketListener,
} from "@/hooks/use-retro-socket";
import { socketURL } from "@/lib/socket";
import { useCallback, useMemo, useRef } from "react";
import useWebSocket from "react-use-websocket";

export default function SocketProvider({
  retroId,
  children,
}: {
  retroId: string;
  children: React.ReactNode;
}) {
  const listeners = useRef(new Set<SocketListener>());

  const { sendJsonMessage, readyState } = useWebSocket(
    socketURL(`/api/retros/${retroId}/ws`).href,
    {
      share: true,
      shouldReconnect: () => true,
      reconnectAttempts: 10,
      reconnectInterval: (attemptNumber) =>
        Math.min(Math.pow(2, attemptNumber) * 1000, 10000),
      // react-use-websocket stores each frame with flushSync, so reading
      // lastJsonMessage re-rendered the whole board synchronously on every
      // message. onMessage runs before filter, and filter gates only that
      // state write, so this pair delivers frames without any render here.
      // A second useWebSocket call on this url must not copy the filter
      // without its own onMessage, or it will receive nothing.
      filter: () => false,
      onMessage: (message) => {
        const event = JSON.parse(message.data) as SocketEvent;

        listeners.current.forEach((listener) => listener(event));
      },
    },
  );

  const subscribe = useCallback((listener: SocketListener) => {
    listeners.current.add(listener);

    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const value = useMemo(
    () => ({ send: sendJsonMessage, subscribe }),
    [sendJsonMessage, subscribe],
  );

  return (
    <RetroSocketContext.Provider value={value}>
      <ReadyStateContext.Provider value={readyState}>
        {children}
      </ReadyStateContext.Provider>
    </RetroSocketContext.Provider>
  );
}
