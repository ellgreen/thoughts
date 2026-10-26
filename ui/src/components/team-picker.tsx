import { useQuery } from "@tanstack/react-query";
import { Button, Label, ListBox, ListBoxItem, Popover, Select, SelectValue } from "react-aria-components";
import { teamsQuery } from "@/lib/retro";

export function TeamPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { data: teams = [] } = useQuery(teamsQuery);
  const items = [{ id: "", name: "No team" }, ...teams];
  return (
    <Select selectedKey={value} onSelectionChange={(k) => onChange(String(k ?? ""))} className="flex flex-col gap-1">
      <Label className="font-bold">
        Team <span className="font-normal text-ink-soft">(retros in a team open with its unfinished actions)</span>
      </Label>
      <Button className="flex min-h-12 items-center justify-between border-[2.5px] border-ink bg-paper px-3 text-left text-lg">
        <SelectValue />
        <svg viewBox="0 0 16 16" className="size-4 fill-none stroke-current stroke-2" aria-hidden="true">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </Button>
      <Popover className="min-w-(--trigger-width) border-[2.5px] border-ink bg-paper">
        <ListBox items={items} className="flex max-h-72 flex-col overflow-y-auto outline-none">
          {(t) => (
            <ListBoxItem id={t.id} textValue={t.name} className="flex min-h-11 cursor-default items-center px-3 outline-none data-focused:bg-blue-tint data-selected:font-bold">
              {t.name}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </Select>
  );
}
