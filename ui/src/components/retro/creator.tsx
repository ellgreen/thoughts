import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import useTemplates from "@/hooks/use-templates";
import { api } from "@/lib/api";
import { Route as RetrosRoute } from "@/routes/_auth.retros.$retroId";
import { Retro } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { BookDashed, Trash2 } from "lucide-react";
import { useFieldArray, useForm, useFormContext } from "react-hook-form";
import { z } from "zod";
import AIRetroTemplate from "./ai-retro-template";
import { useAuth } from "@/hooks/use-auth";

const schema = z.object({
  title: z.string().min(5).max(255),
  columns: z
    .array(
      z.object({
        title: z.string().min(2).max(255),
        description: z.string().max(255),
      }),
    )
    .min(2, "At least 2 columns are required")
    .max(5, "At most 5 columns are allowed"),
  unlisted: z.boolean().optional(),
});

export default function Creator({ className }: { className?: string }) {
  const navigate = useNavigate();

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      columns: [],
      unlisted: false,
    },
  });

  function handleSubmit(data: z.infer<typeof schema>) {
    api.post<Retro>("/api/retros", data).then((response) => {
      navigate({ to: RetrosRoute.path, params: { retroId: response.data.id } });
    });
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Create a retrospective</CardTitle>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="My Teams Retro - Sprint 99"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Give your retrospective a title
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Columns />

            <FormField
              control={form.control}
              name="unlisted"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Unlisted</FormLabel>
                    <FormDescription>
                      If checked, the retrospective will not be listed on the
                      home page.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <Button type="submit">Create</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function Columns() {
  const { fields, append, remove } = useFieldArray({ name: "columns" });
  const { control } = useFormContext();

  const { user } = useAuth();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Columns</h3>

      {fields.map((field, index) => (
        <ColumnInput
          key={field.id}
          index={index}
          onRemove={() => remove(index)}
        />
      ))}

      <FormField control={control} name="columns" render={() => <FormMessage />} />

      <div className="flex gap-2">
        <Button
          type="button"
          onClick={() => append({ title: "", description: "" })}
          variant="secondary"
          className="flex-1"
        >
          Add Column
        </Button>

        <div className="flex-1">
          <FromTemplateDropDown />
        </div>

        {user?.ai_enabled && (
          <div className="flex-1">
            <AIRetroTemplate />
          </div>
        )}
      </div>
    </div>
  );
}

function ColumnInput({
  index,
  onRemove,
}: {
  index: number;
  onRemove: () => void;
}) {
  const { control } = useFormContext();

  return (
    <div className="rounded-md border animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/40">
        <span className="text-sm font-medium text-muted-foreground">
          Column {index + 1}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        <FormField
          control={control}
          name={`columns.${index}.title`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input {...field} />
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
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}

function FromTemplateDropDown() {
  const templates = useTemplates();
  const { setValue } = useFormContext();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" type="button" className="w-full">
          <BookDashed />
          From Template
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-max">
        {templates.map((template) => (
          <DropdownMenuItem
            key={template.title}
            onClick={() => setValue("columns", template.columns)}
          >
            {template.title}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
