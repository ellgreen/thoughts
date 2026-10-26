import { Autocomplete, Header, Input, ListBox, ListBoxItem, ListBoxSection, SearchField, useFilter } from "react-aria-components";
import { Sheet } from "@/components/dialog";
import type { Note } from "@/lib/retro";
import { useBoard } from "./context";

// MovePicker is the keyboard way to group: pick a group to join, or a column
// to start a new pile in.
export function MovePicker({ note, onClose }: { note: Note; onClose: () => void }) {
  const { board, run } = useBoard();
  const { contains } = useFilter({ sensitivity: "base" });
  const grouping = board.retro.stage === "group";
  const current = board.groups.find((g) => g.notes.some((n) => n.id === note.id));

  type Option = { id: string; label: string; section: string; args: object };
  const options: Option[] = [];
  if (grouping) {
    for (const g of board.groups) {
      if (g.id === current?.id) continue;
      const column = board.retro.columns.find((c) => c.id === g.columnId)?.title ?? "";
      const label = g.title || g.notes[0]?.content || "Untitled";
      options.push({ id: `g:${g.id}`, label: `${label}${g.notes.length > 1 ? ` (${g.notes.length})` : ""}`, section: `Join a group in ${column}`, args: { id: note.id, groupId: g.id } });
    }
  }
  for (const c of board.retro.columns) {
    if (!grouping && c.id === current?.columnId) continue;
    options.push({ id: `c:${c.id}`, label: grouping ? `On its own in ${c.title}` : c.title, section: grouping ? "Take it out" : "Move to column", args: { id: note.id, columnId: c.id } });
  }
  const sections = new Map<string, Option[]>();
  for (const o of options) sections.set(o.section, [...(sections.get(o.section) ?? []), o]);

  return (
    <Sheet isOpen onOpenChange={(o) => !o && onClose()} title="Move to…">
      <p className="text-ink-soft">“{note.content}”</p>
      <Autocomplete filter={contains}>
        <SearchField aria-label="Find a group or column" autoFocus onKeyDown={(e) => e.key === "Escape" && onClose()}>
          <Input placeholder="Type to find a group" className="min-h-12 w-full border-[2.5px] border-ink bg-paper px-3 text-lg outline-none" />
        </SearchField>
        <ListBox
          aria-label="Where to"
          className="flex max-h-[50dvh] flex-col overflow-y-auto"
          onAction={(key) => {
            const o = options.find((x) => x.id === key);
            onClose();
            if (o) run("note.move", o.args);
          }}
          renderEmptyState={() => <p className="p-3 text-ink-soft">Nothing matches that.</p>}
        >
          {[...sections.entries()].map(([section, items]) => (
            <ListBoxSection key={section} id={section}>
              <Header className="pt-3 pb-1 font-display text-lg">{section}</Header>
              {items.map((o) => (
                <ListBoxItem key={o.id} id={o.id} textValue={o.label} className="flex min-h-11 cursor-default items-center px-3 outline-none data-focused:bg-blue-tint">
                  <span className="line-clamp-2">{o.label}</span>
                </ListBoxItem>
              ))}
            </ListBoxSection>
          ))}
        </ListBox>
      </Autocomplete>
    </Sheet>
  );
}
