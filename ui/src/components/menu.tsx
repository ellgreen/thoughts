import { useEffect, useRef, useState, type ReactNode } from "react";
import { MenuItem, MenuTrigger, Popover, type PopoverProps } from "react-aria-components";

export const popover = "border-[1.5px] border-ink bg-paper text-ink data-entering:animate-[fade_120ms_ease-out] data-exiting:animate-[fade_120ms_ease-in_reverse]";

// QuickMenu is non-modal, so pressing another note's menu opens it at once
// instead of only closing this one. Non-modal popovers don't close on an
// outside press by themselves.
export function QuickMenu({ trigger, children, className = "", ...rest }: { trigger: ReactNode; children: ReactNode; className?: string } & Omit<PopoverProps, "children" | "className" | "trigger">) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t)) return;
      // On its own trigger, keep focus in the menu: its blur would close it
      // and the trigger's press would open it straight back up.
      if (triggerRef.current?.contains(t)) return e.preventDefault();
      setOpen(false);
    };
    document.addEventListener("pointerdown", close, true);
    return () => document.removeEventListener("pointerdown", close, true);
  }, [open]);
  return (
    <MenuTrigger isOpen={open} onOpenChange={setOpen}>
      <span ref={triggerRef} className="contents">
        {trigger}
      </span>
      <Popover ref={popoverRef} offset={4} isNonModal {...rest} className={`${popover} ${className}`}>
        {children}
      </Popover>
    </MenuTrigger>
  );
}

export function Item({ id, label }: { id: string; label: string }) {
  return (
    <MenuItem id={id} className="flex min-h-11 cursor-default items-center px-3 font-semibold outline-none data-focused:bg-blue-tint">
      {label}
    </MenuItem>
  );
}
