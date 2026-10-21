import { useCallback, useEffect, useRef, useState } from "react";
import type { Board, Person } from "./retro";

export type Status = "connecting" | "open" | "reconnecting";

type Frame =
  | { type: "board"; board: Board }
  | { type: "presence"; people: Person[] }
  | { type: "ack"; ref: string }
  | { type: "error"; ref?: string; message: string };

type Pending = { resolve: () => void; reject: (e: Error) => void };

export class CommandError extends Error {}

export function socketURL(retroId: string) {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/retros/${encodeURIComponent(retroId)}/socket`;
}

// backoff doubles from half a second up to ten, with jitter so a room full
// of laptops waking up doesn't reconnect in lockstep.
export function backoff(attempt: number) {
  const base = Math.min(10_000, 500 * 2 ** attempt);
  return base / 2 + Math.random() * (base / 2);
}

export function useRetroSocket(retroId: string) {
  const [board, setBoard] = useState<Board | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [status, setStatus] = useState<Status>("connecting");
  const socket = useRef<WebSocket | null>(null);
  const pending = useRef(new Map<string, Pending>());
  const refs = useRef(0);

  useEffect(() => {
    let attempt = 0;
    let timer: number | undefined;
    let stopped = false;
    // A fresh connection always starts with a full board, so versions only
    // need comparing within one connection.
    let version = -1;

    function connect() {
      const ws = new WebSocket(socketURL(retroId));
      // Each connection settles only its own commands: an old socket's close
      // can land after its replacement has sent some.
      const waiting = new Map<string, Pending>();
      socket.current = ws;
      pending.current = waiting;
      version = -1;
      ws.onopen = () => {
        attempt = 0;
        setStatus("open");
      };
      ws.onmessage = (e) => {
        const f = JSON.parse(e.data) as Frame;
        switch (f.type) {
          case "board":
            if (f.board.version >= version) {
              version = f.board.version;
              setBoard({ ...f.board, clockOffset: Date.parse(f.board.serverNow) - Date.now() });
            }
            break;
          case "presence":
            setPeople(f.people);
            break;
          case "ack":
            waiting.get(f.ref)?.resolve();
            waiting.delete(f.ref);
            break;
          case "error":
            if (f.ref) {
              waiting.get(f.ref)?.reject(new CommandError(f.message));
              waiting.delete(f.ref);
            }
            break;
        }
      };
      ws.onclose = () => {
        for (const p of waiting.values()) p.reject(new CommandError("The connection dropped before that was saved. Try again."));
        waiting.clear();
        if (stopped) return;
        setStatus("reconnecting");
        timer = window.setTimeout(connect, backoff(attempt++));
      };
    }

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      socket.current?.close();
    };
  }, [retroId]);

  const send = useCallback((name: string, args?: unknown) => {
    const ws = socket.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new CommandError("Not connected right now. It'll reconnect in a moment."));
    }
    const ref = String(++refs.current);
    return new Promise<void>((resolve, reject) => {
      pending.current.set(ref, { resolve, reject });
      ws.send(JSON.stringify({ ref, name, args }));
    });
  }, []);

  return { board, people, status, send };
}
