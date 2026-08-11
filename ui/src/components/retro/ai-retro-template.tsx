import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { spring, springy } from "@/lib/motion";
import { AIRetroTemplateResponse } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles, WandSparkles } from "lucide-react";
import { m } from "motion/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

const schema = z.object({
  prompt: z
    .string()
    .trim()
    .min(2, "Give it something to work with")
    .max(128, "That's a bit long. Keep it under 128 characters"),
});

const suggestions = [
  "Star Wars",
  "The Great British Bake Off",
  "Pirates",
  "Deep sea",
  "Heist movie",
  "Formula 1",
];

export interface GeneratedColumn {
  title: string;
  description: string;
}

export default function AIRetroTemplate({
  onApply,
  onGeneratingChange,
}: {
  onApply: (columns: GeneratedColumn[]) => void;
  onGeneratingChange?: (generating: boolean) => void;
}) {
  const [generating, setGenerating] = useState(false);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { prompt: "" },
  });

  function generate(prompt: string) {
    if (generating) return;

    setGenerating(true);
    onGeneratingChange?.(true);

    api
      .post<AIRetroTemplateResponse>("/api/ai/retro-template", { prompt })
      .then((res) => {
        onApply(res.data.columns);

        toast.success(`${res.data.theme} it is ✨`, {
          description: `${res.data.columns.length} columns ready. Tweak anything you like.`,
        });
      })
      .catch(() => {
        toast.error("Couldn't dream that one up", {
          description: "Try a different theme, or pick a template instead.",
        });
      })
      .finally(() => {
        setGenerating(false);
        onGeneratingChange?.(false);
      });
  }

  // Validates through react-hook-form without an enclosing <form> element.
  const submit = form.handleSubmit((data) => generate(data.prompt));

  function applySuggestion(suggestion: string) {
    form.setValue("prompt", suggestion);
    generate(suggestion);
  }

  const error = form.formState.errors.prompt?.message;

  return (
    <div className="relative overflow-hidden rounded-xl p-px">
      <m.div
        aria-hidden
        className="absolute inset-[-100%] bg-[conic-gradient(from_0deg,var(--chart-1),var(--chart-2),var(--chart-4),var(--chart-1))]"
        animate={generating ? { rotate: 360 } : { rotate: 0 }}
        transition={
          generating
            ? { duration: 2.5, repeat: Infinity, ease: "linear" }
            : { duration: 0.4 }
        }
        style={{ opacity: generating ? 0.9 : 0.35 }}
      />

      <div className="relative rounded-[11px] bg-surface p-3.5">
        <div className="flex items-center gap-2">
          <m.span
            aria-hidden
            className="text-[var(--chart-1)]"
            animate={
              generating
                ? { scale: [1, 1.25, 1], rotate: [0, 12, -8, 0] }
                : { scale: 1, rotate: 0 }
            }
            transition={
              generating
                ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
                : spring
            }
          >
            <Sparkles className="size-4" />
          </m.span>

          <h4 className="text-sm font-medium">Conjure a themed board</h4>

          <span className="ml-auto text-xs text-muted-foreground">
            Powered by AI
          </span>
        </div>

        <p className="mt-1 text-xs text-muted-foreground">
          Name a theme and we'll write the columns around it.
        </p>

        {/* Deliberately not a <form>: this sits inside the create-retro form,
            and HTML has no nested forms - the browser drops the inner one, so
            a submit button here would submit the outer form and create the
            retro instead of generating anything. */}
        <div className="mt-3 flex gap-2">
          <Input
            autoComplete="off"
            placeholder="a heist movie"
            disabled={generating}
            aria-label="Retro theme"
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;

              event.preventDefault();
              submit();
            }}
            {...form.register("prompt")}
          />

          <Button
            type="button"
            onClick={submit}
            disabled={generating}
            className="w-32 shrink-0 gap-1.5"
          >
            <m.span
              aria-hidden
              animate={generating ? { rotate: [0, -12, 12, 0] } : { rotate: 0 }}
              transition={
                generating
                  ? { duration: 1, repeat: Infinity, ease: "easeInOut" }
                  : springy
              }
              className="flex"
            >
              <WandSparkles className="size-4" />
            </m.span>
            {generating ? "Conjuring…" : "Generate"}
          </Button>
        </div>

        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {suggestions.map((suggestion, i) => (
            <m.button
              key={suggestion}
              type="button"
              disabled={generating}
              onClick={() => applySuggestion(suggestion)}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: 0.03 * i }}
              whileHover={{ y: -1 }}
              className="rounded-full border border-border/70 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-[var(--chart-1)] hover:text-foreground disabled:opacity-50"
            >
              {suggestion}
            </m.button>
          ))}
        </div>
      </div>
    </div>
  );
}
