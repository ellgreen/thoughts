import { Button, Dialog, DialogTrigger, Popover } from "react-aria-components";
import { Kbd, useShortcuts } from "@/keys/keys";
import { popover } from "./menu";
import { ThemeChoice } from "./theme-toggle";
import { initials } from "./ui";

const row = "flex min-h-11 items-center justify-between gap-3 px-1 text-left font-semibold hover:underline underline-offset-4";

export function AccountMenu({ name, onSignOut }: { name: string; onSignOut: () => void }) {
  const shortcuts = useShortcuts();
  return (
    <DialogTrigger>
      <Button aria-label={`Account: ${name}`} className="inline-flex size-11 items-center justify-center">
        <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-stamp bg-blue-tint text-sm font-bold text-ink">
          {initials(name)}
        </span>
      </Button>
      <Popover placement="bottom end" offset={4} className={`w-64 ${popover}`}>
        <Dialog aria-label="Account" className="flex flex-col gap-3 p-4 outline-none">
          {({ close }) => (
            <>
              <p className="font-bold break-words">{name}</p>
              <ThemeChoice />
              <div className="flex flex-col border-t-[1.5px] border-line pt-1">
                <Button
                  className={`${row} pointer-coarse:hidden`}
                  onPress={() => {
                    close();
                    shortcuts.find((s) => s.id === "help")?.run();
                  }}
                >
                  Keyboard shortcuts <Kbd keys="?" />
                </Button>
                <Button className={row} onPress={onSignOut}>
                  Sign out
                </Button>
              </div>
            </>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
