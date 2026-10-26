import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Autocomplete, Input, ListBox, ListBoxItem, ListBoxSection, Header, SearchField, useFilter } from "react-aria-components";
import { Sheet } from "@/components/dialog";
import { retrosQuery } from "@/lib/retro";
import { isMac, Kbd, useShortcut, useShortcuts, type Shortcut } from "./keys";

type Command = { id: string; label: string; section: string; keys?: string; run: () => void };

export function KeyboardLayer() {
  const [help, setHelp] = useState(false);
  const [palette, setPalette] = useState(false);
  useShortcut({ id: "help", keys: "?", label: "Show keyboard shortcuts", section: "Anywhere", run: () => setHelp(true) });
  // Ctrl+K on a Mac too: people reach for either, and a miss sends what they
  // type next to the board's single-key shortcuts.
  useShortcut({ id: "palette", keys: isMac ? "mod+k ctrl+k" : "mod+k", label: "Find a command or retro", section: "Anywhere", run: () => setPalette(true) });

  return (
    <>
      <ShortcutHelp isOpen={help} onOpenChange={setHelp} />
      {palette && <Palette onClose={() => setPalette(false)} />}
    </>
  );
}

function grouped(list: Shortcut[]) {
  const sections = new Map<string, Shortcut[]>();
  for (const s of list) sections.set(s.section, [...(sections.get(s.section) ?? []), s]);
  return [...sections.entries()];
}

function ShortcutHelp({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (o: boolean) => void }) {
  const list = useShortcuts();
  return (
    <Sheet isOpen={isOpen} onOpenChange={onOpenChange} title="Keyboard shortcuts" wide>
      <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
        {grouped(list).map(([section, items]) => (
          <section key={section}>
            <h3 className="mb-2 font-display text-xl">{section}</h3>
            <dl className="flex flex-col">
              {items.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-4 border-b-[1.5px] border-blue-tint py-1.5">
                  <dt>{s.label}</dt>
                  <dd className="flex gap-1">
                    {s.keys.split(" ").map((k) => (
                      <Kbd key={k} keys={k} />
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Sheet>
  );
}

function Palette({ onClose }: { onClose: () => void }) {
  const shortcuts = useShortcuts();
  const { data: retros = [] } = useQuery(retrosQuery);
  const navigate = useNavigate();
  const { contains } = useFilter({ sensitivity: "base" });

  const commands: Command[] = [
    ...shortcuts.filter((s) => !s.hidden && s.id !== "palette").map((s) => ({ id: s.id, label: s.label, section: s.section, keys: s.keys, run: s.run })),
    ...retros.map((r) => ({
      id: `retro-${r.id}`,
      label: r.title,
      section: "Retros",
      run: () => navigate({ to: "/retros/$retroId", params: { retroId: r.id } }),
    })),
  ];
  const sections = new Map<string, Command[]>();
  for (const c of commands) sections.set(c.section, [...(sections.get(c.section) ?? []), c]);

  return (
    <Sheet isOpen onOpenChange={(o) => !o && onClose()} title="Do something">
      <Autocomplete filter={contains}>
        <SearchField aria-label="Search commands and retros" autoFocus onKeyDown={(e) => e.key === "Escape" && onClose()} className="flex">
          <Input placeholder="Type to search" className="min-h-12 w-full border-[2.5px] border-ink bg-paper px-3 text-lg outline-none" />
        </SearchField>
        <ListBox
          aria-label="Commands"
          className="flex max-h-[50dvh] flex-col overflow-y-auto"
          onAction={(key) => {
            const c = commands.find((x) => x.id === key);
            onClose();
            c?.run();
          }}
          renderEmptyState={() => <p className="p-3 text-ink-soft">Nothing matches that.</p>}
        >
          {[...sections.entries()].map(([section, items]) => (
            <ListBoxSection key={section} id={section}>
              <Header className="pt-3 pb-1 font-display text-lg">{section}</Header>
              {items.map((c) => (
                <ListBoxItem
                  key={c.id}
                  id={c.id}
                  textValue={c.label}
                  className="flex min-h-11 cursor-default items-center justify-between gap-3 px-3 outline-none data-focused:bg-blue-tint"
                >
                  <span>{c.label}</span>
                  {c.keys && <Kbd keys={c.keys} />}
                </ListBoxItem>
              ))}
            </ListBoxSection>
          ))}
        </ListBox>
      </Autocomplete>
    </Sheet>
  );
}
