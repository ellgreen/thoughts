import { ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { setTheme, useShowing, useTheme, type Theme } from "@/lib/theme";
import { IconButton } from "./icon-button";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const to = useShowing() === "dark" ? "light" : "dark";
  return <IconButton icon={to === "light" ? "sun" : "moon"} label={`Switch to ${to} theme`} onPress={() => setTheme(to)} className={className} />;
}

const choices: { id: Theme; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

export function ThemeChoice() {
  const theme = useTheme();
  return (
    <ToggleButtonGroup
      aria-label="Theme"
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[theme]}
      onSelectionChange={(keys) => setTheme([...keys][0] as Theme)}
      className="grid grid-cols-3 border-[1.5px] border-ink"
    >
      {choices.map((c) => (
        <ToggleButton key={c.id} id={c.id} className="min-h-11 text-sm font-semibold hover:bg-blue-tint data-selected:bg-ink data-selected:text-paper">
          {c.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
