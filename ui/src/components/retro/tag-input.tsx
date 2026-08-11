import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { XIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

const maxTags = 10;
const maxSuggestions = 8;

interface Option {
  /** Already normalised. */
  value: string;
  label: string;
  isNew?: boolean;
}

/** The only form the server sees. */
function normalise(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, "-");
}

export default function TagInput({
  value,
  onChange,
  placeholder = "Add tag...",
  className,
}: TagInputProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    api.get<string[]>("/api/tags").then((res) => {
      if (res.status === 200) setSuggestions(res.data);
    });
  }, []);

  const typed = normalise(input);

  const matches = suggestions
    .filter((s) => !value.includes(s) && (typed === "" || s.includes(typed)))
    .slice(0, maxSuggestions);

  // Matches first, so Tab completes to a real tag rather than what you
  // half-typed.
  const options: Option[] = [
    ...matches.map((tag) => ({ value: tag, label: tag })),
    ...(typed && !matches.includes(typed) && !value.includes(typed)
      ? [{ value: typed, label: `Add "${typed}"`, isNew: true }]
      : []),
  ];

  const showList = open && options.length > 0;
  const active = showList ? options[Math.min(activeIndex, options.length - 1)] : undefined;

  function addTag(tag: string) {
    const clean = normalise(tag);

    if (!clean || value.includes(clean) || value.length >= maxTags) return;

    onChange([...value, clean]);
    setInput("");
    setActiveIndex(0);
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function move(delta: number) {
    if (options.length === 0) return;

    setOpen(true);
    setActiveIndex((i) => {
      const next = Math.min(i, options.length - 1) + delta;

      return (next + options.length) % options.length;
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(1);
        return;

      case "ArrowUp":
        e.preventDefault();
        move(-1);
        return;

      // With nothing typed there is nothing to complete, so Tab moves focus
      // on as normal.
      case "Tab":
        if (e.shiftKey || !input.trim() || !active) return;

        e.preventDefault();
        addTag(active.value);
        return;

      case "Enter":
        if (!input.trim() && !active) return;

        e.preventDefault();
        addTag(active ? active.value : input);
        return;

      case ",":
        if (!input.trim()) return;

        e.preventDefault();
        addTag(input);
        return;

      case "Backspace":
        if (!input && value.length > 0) removeTag(value[value.length - 1]);
        return;

      case "Escape":
        setOpen(false);
        return;
    }
  }

  return (
    <Popover open={showList} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs dark:bg-input/30",
            "cursor-text transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
            className,
          )}
          onClick={() => {
            inputRef.current?.focus();
            setOpen(true);
          }}
        >
          {value.map((tag) => (
            <Badge key={tag} variant="default" className="shrink-0 gap-1 pr-1">
              {tag}
              <button
                type="button"
                aria-label={`Remove tag ${tag}`}
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(tag);
                }}
                className="rounded-sm p-0.5 hover:bg-primary-foreground/20"
              >
                <XIcon className="size-2.5" />
              </button>
            </Badge>
          ))}

          <input
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setActiveIndex(0);
              setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setOpen(true)}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              active ? `${listId}-${active.value}` : undefined
            }
            aria-label="Add a tag"
            placeholder={value.length === 0 ? placeholder : ""}
            className="min-w-[120px] flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </div>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-1"
        // The list is driven from the input's keydown handler, so stealing
        // focus would close the thing being navigated.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={() => setOpen(false)}
      >
        <ul id={listId} role="listbox" className="max-h-56 overflow-y-auto">
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${listId}-${option.value}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(e) => {
                // Before blur, so the input never loses focus to the click.
                e.preventDefault();
                addTag(option.value);
              }}
              className={cn(
                "cursor-pointer rounded-sm px-2 py-1.5 text-sm",
                index === activeIndex && "bg-accent text-accent-foreground",
                option.isNew && "text-muted-foreground",
              )}
            >
              {option.label}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
