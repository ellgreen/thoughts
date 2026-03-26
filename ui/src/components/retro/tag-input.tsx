import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

export default function TagInput({ value, onChange, placeholder = "Add tag…", className }: TagInputProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<string[]>("/api/tags").then((res) => {
      if (res.status === 200) setSuggestions(res.data);
    });
  }, []);

  const filtered = suggestions.filter(
    (s) => !value.includes(s) && (input === "" || s.toLowerCase().includes(input.toLowerCase()))
  );

  // Also show freetyped value as an option if it's new
  const canAddInput = input.trim() && !value.includes(input.trim().toLowerCase());

  function addTag(tag: string) {
    const clean = tag.trim().toLowerCase().replace(/\s+/g, "-");
    if (!clean || value.includes(clean) || value.length >= 10) return;
    onChange([...value, clean]);
    setInput("");
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      addTag(input);
      setOpen(false);
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      removeTag(value[value.length - 1]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <Popover open={open && (filtered.length > 0 || !!canAddInput)} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent dark:bg-input/30 px-2.5 py-1.5 text-sm shadow-xs cursor-text min-h-9",
            "transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
            className
          )}
          onClick={() => { inputRef.current?.focus(); setOpen(true); }}
        >
          {value.map((tag) => (
            <Badge key={tag} variant="default" className="gap-1 pr-1 shrink-0">
              {tag}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                className="rounded-sm hover:bg-primary-foreground/20 p-0.5"
              >
                <XIcon className="size-2.5" />
              </button>
            </Badge>
          ))}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); setOpen(true); }}
            onKeyDown={handleKeyDown}
            onFocus={() => setOpen(true)}
            placeholder={value.length === 0 ? placeholder : ""}
            className="flex-1 min-w-[120px] bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[var(--radix-popover-trigger-width)]"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={() => setOpen(false)}
      >
        <Command shouldFilter={false}>
          <CommandList>
            <CommandEmpty>No matching tags.</CommandEmpty>
            <CommandGroup>
              {canAddInput && (
                <CommandItem
                  value={input.trim()}
                  onSelect={() => { addTag(input); setOpen(false); }}
                >
                  Add "{input.trim()}"
                </CommandItem>
              )}
              {filtered.slice(0, 8).map((tag) => (
                <CommandItem
                  key={tag}
                  value={tag}
                  onSelect={() => { addTag(tag); setOpen(false); }}
                >
                  {tag}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
