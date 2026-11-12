import { Button, Tooltip, TooltipTrigger, type ButtonProps } from "react-aria-components";
import { Kbd } from "@/keys/keys";
import { Icon, type IconName } from "./icons";

type Props = Omit<ButtonProps, "children" | "className" | "aria-label"> & { icon: IconName; label: string; keys?: string; className?: string };

export function IconButton({ icon, label, keys, className = "", ...button }: Props) {
  return (
    <TooltipTrigger delay={400}>
      <Button {...button} aria-label={label} className={`inline-flex size-11 shrink-0 items-center justify-center text-ink hover:bg-blue-tint disabled:opacity-40 ${className}`}>
        <Icon name={icon} />
      </Button>
      <Tooltip offset={6} className="flex items-center gap-2 border-[1.5px] border-ink bg-paper px-2 py-1 text-sm font-semibold text-ink">
        {label}
        {keys && <Kbd keys={keys} />}
      </Tooltip>
    </TooltipTrigger>
  );
}
