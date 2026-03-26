import { useAuth } from "@/hooks/use-auth";
import useTheme, { Theme } from "@/hooks/use-theme";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useEffect } from "react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export default function Nav() {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) return;
    navigate({ to: "/login" });
  }, [user]);

  const themeIcon = theme === "dark" ? <Moon className="size-4" /> : theme === "light" ? <Sun className="size-4" /> : <Monitor className="size-4" />;

  return (
    <header className="sticky top-0 z-50 bg-background/75 backdrop-blur-xl rounded-b-xl ring-1 ring-border/40 shadow-[0_4px_24px_-4px_color-mix(in_oklch,var(--primary)_12%,transparent)]">
      <div className="max-w-[1600px] mx-auto px-8 h-12 flex items-center justify-between gap-4">
        <Link
          to="/"
          className="font-bold tracking-tight hover:opacity-80 transition-opacity"
          style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", letterSpacing: "-0.02em" }}
        >
          thoughts..
        </Link>

        <div className="flex-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
              {themeIcon}
              <span>{user?.name}</span>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={theme}
              onValueChange={(v) => setTheme(v as Theme)}
            >
              <DropdownMenuRadioItem value="light">
                <Sun className="size-4 mr-2" />
                Light
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <Moon className="size-4 mr-2" />
                Dark
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <Monitor className="size-4 mr-2" />
                System
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={logout}>
              <LogOut className="size-4 mr-2" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
