import { AutoTextarea } from "@/components/ui/auto-textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { accentForIndex } from "@/lib/column-accent";
import { cardVariants, spring, stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Route as RetrosRoute } from "@/routes/_auth.retros.$retroId";
import { Retro } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { Columns3, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useState } from "react";
import { Control, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import AIRetroTemplate from "./ai-retro-template";
import TagInput from "./tag-input";
import TemplatePicker from "./template-picker";

const minColumns = 2;
const maxColumns = 5;
const maxDescription = 255;

const schema = z.object({
  title: z.string().trim().min(5).max(255),
  columns: z
    .array(
      z.object({
        title: z.string().trim().min(2).max(255),
        description: z.string().trim().max(maxDescription),
      }),
    )
    .min(minColumns, `Add at least ${minColumns} columns`)
    .max(maxColumns, `${maxColumns} columns is the most a board can hold`),
  unlisted: z.boolean().optional(),
  tags: z.array(z.string().min(1).max(50)).max(10).optional(),
});

type FormValues = z.infer<typeof schema>;
type ColumnDraft = FormValues["columns"][number];

const emptyColumn: ColumnDraft = { title: "", description: "" };

export default function Creator() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Typed explicitly: inferring from empty defaults gives columns: never[].
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      columns: [],
      unlisted: false,
      tags: [],
    },
  });

  const columns = useFieldArray({ control: form.control, name: "columns" });

  function handleSubmit(data: FormValues) {
    api
      .post<Retro>("/api/retros", data)
      .then((response) => {
        setOpen(false);
        form.reset();
        navigate({
          to: RetrosRoute.path,
          params: { retroId: response.data.id },
        });
      })
      .catch(() => {
        toast.error("Couldn't create the retro", {
          description: "Give it another go in a moment.",
        });
      });
  }

  // Templates and AI replace the set outright: replace() regenerates the field
  // keys, so the cards animate in as new rather than the old ones mutating.
  function applyColumns(next: ColumnDraft[]) {
    columns.replace(next.slice(0, maxColumns));
    form.clearErrors("columns");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          New retro
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create a retrospective</DialogTitle>
          <DialogDescription>
            Start from a template, dream one up, or write your own. Everything
            here can be changed later.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="mt-4 space-y-6"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      autoFocus
                      placeholder="Team Rocket — Sprint 24"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <ColumnsSection
              control={form.control}
              fields={columns.fields}
              generating={generating}
              onApply={applyColumns}
              onAdd={() => columns.append(emptyColumn)}
              onRemove={columns.remove}
              onGeneratingChange={setGenerating}
            />

            <Details control={form.control} />

            <DialogFooter className="border-t pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Create retro
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ColumnsSection({
  control,
  fields,
  generating,
  onApply,
  onAdd,
  onRemove,
  onGeneratingChange,
}: {
  control: Control<FormValues>;
  fields: { id: string }[];
  generating: boolean;
  onApply: (columns: ColumnDraft[]) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onGeneratingChange: (generating: boolean) => void;
}) {
  const { user } = useAuth();

  const full = fields.length >= maxColumns;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">Columns</h3>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs tabular-nums",
              full
                ? "bg-muted text-muted-foreground"
                : "bg-muted/60 text-muted-foreground",
            )}
          >
            {fields.length} of {maxColumns}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <TemplatePicker onApply={onApply} />
          <Button
            type="button"
            variant="secondary"
            onClick={onAdd}
            disabled={full}
          >
            <Plus className="size-4" />
            Add
          </Button>
        </div>
      </div>

      {user?.ai_enabled && (
        <AIRetroTemplate
          onApply={onApply}
          onGeneratingChange={onGeneratingChange}
        />
      )}

      {/* Columns you already have stay put while a generation runs: they are
          only replaced if it succeeds, and flashing them away and back on a
          failure would look like losing your work. */}
      <div
        className={cn(
          "space-y-2.5 transition-opacity",
          generating && fields.length > 0 && "opacity-50",
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {fields.length === 0 && generating && (
            <GeneratingPlaceholder key="generating" />
          )}

          {fields.length === 0 && !generating && <EmptyColumns key="empty" />}

          {fields.map((field, index) => (
            <ColumnCard
              key={field.id}
              control={control}
              index={index}
              onRemove={() => onRemove(index)}
              canRemove={fields.length > minColumns}
            />
          ))}
        </AnimatePresence>
      </div>

      <FormField
        control={control}
        name="columns"
        render={() => <FormMessage />}
      />
    </section>
  );
}

function ColumnCard({
  control,
  index,
  onRemove,
  canRemove,
}: {
  control: Control<FormValues>;
  index: number;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const accent = accentForIndex(index);

  return (
    <m.div
      layout
      variants={cardVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={stagger(index)}
      className="group relative overflow-hidden rounded-xl bg-surface-raised pr-2 pl-4 ring-1 ring-border/70"
    >
      {/* The colour this column will actually be on the board. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: accent }}
      />

      <div className="flex items-start gap-2 py-3">
        <div className="min-w-0 flex-1 space-y-2">
          <FormField
            control={control}
            name={`columns.${index}.title`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    placeholder="What went well"
                    aria-label={`Column ${index + 1} title`}
                    className="h-8 border-0 bg-transparent px-0 font-medium shadow-none focus-visible:ring-0 dark:bg-transparent"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`columns.${index}.description`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <AutoTextarea
                    placeholder="A prompt to help people fill this column in…"
                    aria-label={`Column ${index + 1} description`}
                    maxLength={maxDescription}
                    className="border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
                    {...field}
                  />
                </FormControl>

                <div className="flex items-center justify-between gap-2">
                  <FormMessage />
                  <CharacterCount value={field.value ?? ""} />
                </div>
              </FormItem>
            )}
          />
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!canRemove}
          onClick={onRemove}
          aria-label={`Remove column ${index + 1}`}
          className="size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-0"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </m.div>
  );
}

/** Only speaks up near the limit, rather than nagging from the first keystroke. */
function CharacterCount({ value }: { value: string }) {
  const remaining = maxDescription - value.length;

  if (remaining > 40) return null;

  return (
    <span
      className={cn(
        "ml-auto shrink-0 text-xs tabular-nums",
        remaining <= 0 ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {remaining} left
    </span>
  );
}

function EmptyColumns() {
  return (
    <m.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={spring}
      className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed px-6 py-8 text-center"
    >
      <Columns3 className="size-5 text-muted-foreground/60" />
      <p className="text-sm font-medium">No columns yet</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        Pick a template, name a theme above, or add your own.
      </p>
    </m.div>
  );
}

/** Shimmering stand-ins so the wait shows its working. */
function GeneratingPlaceholder() {
  return (
    <m.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={spring}
      className="space-y-2.5"
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-xl bg-surface-raised py-3 pr-2 pl-4 ring-1 ring-border/70"
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-1 animate-pulse"
            style={{ background: accentForIndex(i) }}
          />
          <div className="space-y-2">
            <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted/70" />
          </div>
        </div>
      ))}
    </m.div>
  );
}

function Details({ control }: { control: Control<FormValues> }) {
  return (
    <section className="space-y-4 border-t pt-5">
      <FormField
        control={control}
        name="tags"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tags</FormLabel>
            <FormControl>
              <TagInput
                value={field.value ?? []}
                onChange={field.onChange}
                placeholder="team-name, project-name"
              />
            </FormControl>
            <FormDescription>
              Groups retros together by team or project. Enter or comma to add.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="unlisted"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center gap-3 space-y-0">
            <FormControl>
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <div className="leading-tight">
              <FormLabel className="font-normal">Unlisted</FormLabel>
              <FormDescription className="text-xs">
                Keep it off the home page — anyone with the link can still join.
              </FormDescription>
            </div>
          </FormItem>
        )}
      />
    </section>
  );
}
