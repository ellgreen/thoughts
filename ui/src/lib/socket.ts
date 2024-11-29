export function socketURL(path: string): URL {
  if (import.meta.env.DEV) {
    return new URL(path, "ws://localhost:3000");
  }

  const { host, protocol } = window.location;

  return new URL(path, (protocol === "http:" ? "ws://" : "wss://") + host);
}
