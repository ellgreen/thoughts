import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ChevronDown, Trash } from "lucide-react";
import {
  FieldValues,
  useFieldArray,
  useForm,
  useFormContext,
} from "react-hook-form";
import { z } from "zod";

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
});

export default function Creator({ className }: { className?: string }) {
  const navigate = useNavigate();

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      columns: [],
    },
  });

  function handleSubmit(data: FieldValues) {
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
            className="space-y-8"
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

            <Button type="submit">Create</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function Columns() {
  const { fields, append, remove } = useFieldArray({ name: "columns" });

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

      <FormField name="columns" render={() => <FormMessage />} />

      <div className="flex items-center space-x-2">
        <Button
          type="button"
          onClick={() => append({ title: "", description: "" })}
          variant="secondary"
        >
          Add Column
        </Button>

        <FromTemplateDropDown />
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
    <div className="group relative p-3 space-y-4 rounded-md border">
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

      <Button
        className="absolute opacity-0 group-hover:opacity-100 -top-6 -right-3 transition-all duration-75"
        type="button"
        variant="destructive"
        size="sm"
        onClick={onRemove}
      >
        <Trash />
      </Button>
    </div>
  );
}

function FromTemplateDropDown() {
  const templates = useTemplates();
  const { setValue } = useFormContext();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" type="button">
          From Template
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
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
