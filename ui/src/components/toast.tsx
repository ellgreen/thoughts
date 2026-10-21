import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Button } from "react-aria-components";

type Toast = { id: number; message: string; action?: { label: string; run: () => void }; tone: "info" | "problem" };
type Show = (message: string, opts?: { action?: Toast["action"]; tone?: Toast["tone"] }) => void;

const Ctx = createContext<Show>(() => {});

export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const show = useCallback<Show>(
    (message, opts = {}) => {
      const id = ++next.current;
      setToasts((t) => [...t.slice(-2), { id, message, action: opts.action, tone: opts.tone ?? "info" }]);
      window.setTimeout(() => dismiss(id), opts.action ? 8000 : 5000);
    },
    [dismiss],
  );

  return (
    <Ctx.Provider value={show}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex max-w-md items-center gap-4 border-[2.5px] border-ink px-4 py-3 font-semibold ${t.tone === "problem" ? "bg-alert" : "bg-paper"}`}
          >
            <span>{t.message}</span>
            {t.action && (
              <Button
                className="min-h-10 shrink-0 underline underline-offset-4"
                onPress={() => {
                  t.action!.run();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </Button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
