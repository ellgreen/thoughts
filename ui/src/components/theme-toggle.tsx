import { Button } from "react-aria-components";
import { setTheme, useShowing } from "@/lib/theme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const to = useShowing() === "dark" ? "light" : "dark";
  return (
    <Button onPress={() => setTheme(to)} aria-label={`Switch to ${to} theme`} className={`inline-flex size-11 items-center justify-center text-ink hover:bg-blue-tint ${className}`}>
      <svg viewBox="0 0 20 20" className="size-5 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]" aria-hidden="true">
        {to === "light" ? (
          <>
            <circle cx="10" cy="10" r="3.5" />
            <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4" />
          </>
        ) : (
          <path d="M16.5 11.8A7 7 0 1 1 8.2 3.5a5.5 5.5 0 0 0 8.3 8.3z" />
        )}
      </svg>
    </Button>
  );
}
