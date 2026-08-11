import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import useTemplates from "@/hooks/use-templates";
import { accentForIndex } from "@/lib/column-accent";
import { BookDashed, ChevronDown } from "lucide-react";

interface TemplateColumn {
  title: string;
  description: string;
}

export default function TemplatePicker({
  onApply,
}: {
  onApply: (columns: TemplateColumn[]) => void;
}) {
  const templates = useTemplates();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" type="button" className="gap-1.5">
          <BookDashed className="size-4" />
          Use a template
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="max-h-96 w-80 overflow-y-auto">
        <DropdownMenuLabel className="text-muted-foreground">
          Tried and tested formats
        </DropdownMenuLabel>

        {templates.map((template) => (
          <DropdownMenuItem
            key={template.title}
            onClick={() => onApply(template.columns)}
            className="flex-col items-start gap-1.5 py-2"
          >
            <span className="font-medium">{template.title}</span>

            <span className="flex flex-wrap gap-1">
              {template.columns.map((column, i) => (
                <span
                  key={column.title}
                  className="rounded-full px-1.5 py-0.5 text-[11px] leading-tight"
                  style={{
                    color: accentForIndex(i),
                    background: `color-mix(in oklch, ${accentForIndex(i)} 14%, transparent)`,
                  }}
                >
                  {column.title}
                </span>
              ))}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
