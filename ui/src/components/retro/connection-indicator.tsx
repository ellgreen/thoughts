import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PayloadConnectionInfo } from "@/events";
import { accentForName, initialsFor } from "@/lib/column-accent";
import { spring, springy } from "@/lib/motion";
import { AnimatePresence, m } from "motion/react";
import { Button } from "../ui/button";

const states: Record<number, { label: string; dot: string; live: boolean }> = {
  0: { label: "Connecting", dot: "bg-yellow-500", live: false },
  1: { label: "Connected", dot: "bg-green-500", live: true },
  2: { label: "Disconnecting", dot: "bg-yellow-500", live: false },
  3: { label: "Disconnected", dot: "bg-red-500", live: false },
};

const maxAvatars = 3;

export default function ConnectionIndicator({
  connectionInfo,
  readyState,
}: {
  connectionInfo: PayloadConnectionInfo;
  readyState: number;
}) {
  const state = states[readyState] ?? {
    label: "Unknown",
    dot: "bg-red-500",
    live: false,
  };

  const users = connectionInfo.users;
  const visible = users.slice(0, maxAvatars);
  const overflow = users.length - visible.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <span className="relative flex size-2">
            {state.live && (
              <span
                className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${state.dot}`}
              />
            )}
            <span
              className={`relative inline-flex size-2 rounded-full ${state.dot}`}
            />
          </span>

          {users.length === 0 ? (
            <span className="text-muted-foreground">{state.label}</span>
          ) : (
            <span className="flex -space-x-1.5">
              <AnimatePresence initial={false} mode="popLayout">
                {visible.map((user) => (
                  <m.span
                    key={user}
                    layout
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={springy}
                    title={user}
                    className="grid size-5 place-items-center rounded-full text-[9px] font-semibold text-background ring-2 ring-background"
                    style={{ background: accentForName(user) }}
                  >
                    {initialsFor(user)}
                  </m.span>
                ))}
              </AnimatePresence>

              {overflow > 0 && (
                <m.span
                  layout
                  transition={spring}
                  className="grid size-5 place-items-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground ring-2 ring-background"
                >
                  +{overflow}
                </m.span>
              )}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-56">
        <p className="mb-2 text-xs text-muted-foreground">{state.label}</p>

        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody else is here.</p>
        ) : (
          <ul className="space-y-2">
            {users.map((user) => (
              <li key={user} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="grid size-5 shrink-0 place-items-center rounded-full text-[9px] font-semibold text-background"
                  style={{ background: accentForName(user) }}
                >
                  {initialsFor(user)}
                </span>
                <span className="truncate text-sm">{user}</span>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
