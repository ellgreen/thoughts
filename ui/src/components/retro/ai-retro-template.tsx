import { Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "../ui/form";
import { AIRetroTemplateResponse } from "@/types";
import z from "zod";
import { useForm, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../ui/input-group";
import { useState } from "react";
import { Spinner } from "../ui/spinner";

const aiTemplateSchema = z.object({
  prompt: z
    .string()
    .min(4, "Please enter a prompt")
    .max(32, "Prompt is too long (max 32 characters)")
    .transform((value) => value.trim()),
});

export default function AIRetroTemplate() {
  const { setValue } = useFormContext();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const form = useForm({
    resolver: zodResolver(aiTemplateSchema),
    defaultValues: {
      prompt: "",
    },
  });

  function handleSubmit(data: z.infer<typeof aiTemplateSchema>) {
    if (isGenerating) return;
    setIsGenerating(true);

    api
      .post<AIRetroTemplateResponse>("/api/ai/retro-template", {
        prompt: data.prompt,
      })
      .then((res) => {
        setValue("columns", res.data.columns);
        toast.success(`A ${res.data.theme} retro has been generated`);
      })
      .catch(() => {
        toast.error("Failed to generate columns from AI");
      })
      .finally(() => {
        setIsGenerating(false);
        setPopoverOpen(false);
      });
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" type="button">
          <Sparkles />
          From AI
        </Button>
      </PopoverTrigger>
      <PopoverContent className="min-w-lg">
        <h4 className="font-medium">Generate a retro template using AI.</h4>
        <p className="text-muted-foreground text-sm mt-2 mb-4">
          Enter a prompt to generate a retro template. The AI will generate
          columns based on the prompt.
        </p>

        <Form {...form}>
          <FormField
            control={form.control}
            name="prompt"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <InputGroup>
                    <InputGroupInput
                      autoComplete="off"
                      placeholder="star wars"
                      {...field}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          form.handleSubmit(handleSubmit)();
                        }
                      }}
                    />

                    <InputGroupAddon align="inline-end">
                      {isGenerating ? (
                        <Spinner />
                      ) : (
                        <InputGroupButton
                          type="button"
                          onClick={form.handleSubmit(handleSubmit)}
                          disabled={isGenerating}
                        >
                          Generate
                        </InputGroupButton>
                      )}
                    </InputGroupAddon>
                  </InputGroup>
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />
        </Form>
      </PopoverContent>
    </Popover>
  );
}
