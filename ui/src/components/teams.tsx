import { useState, type FormEvent } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button, Input, Label, TextField } from "react-aria-components";
import { Sheet } from "@/components/dialog";
import { button, input } from "@/components/ui";
import { messageOf } from "@/lib/api";
import { createTeam, teamsQuery } from "@/lib/retro";

export function Teams() {
  const { data: teams } = useSuspenseQuery(teamsQuery);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <nav aria-label="Teams" className="flex flex-wrap items-center gap-x-5 gap-y-1">
        {teams.map((t) => (
          <Link key={t.id} to="/t/$slug" params={{ slug: t.slug }} className="inline-flex min-h-11 items-baseline gap-2 py-2.5 font-bold underline-offset-4 hover:underline">
            {t.name}
            {t.openActions > 0 && <span className="text-sm font-normal text-ink-soft">{t.openActions} to do</span>}
          </Link>
        ))}
        <Button onPress={() => setCreating(true)} className={`${button.quiet} px-0`}>
          New team
        </Button>
      </nav>
      {teams.length === 0 && (
        <p className="max-w-[56ch] text-ink-soft">A team keeps its retros together, and each new retro opens with the actions the last one left unfinished.</p>
      )}
      <NewTeam isOpen={creating} onOpenChange={setCreating} />
    </>
  );
}

export function NewTeam({ isOpen, onOpenChange, fromTag }: { isOpen: boolean; onOpenChange: (o: boolean) => void; fromTag?: string }) {
  return (
    <Sheet isOpen={isOpen} onOpenChange={onOpenChange} title={fromTag ? `Make #${fromTag} a team` : "New team"}>
      {(close) => <NewTeamForm close={close} fromTag={fromTag} />}
    </Sheet>
  );
}

function NewTeamForm({ close, fromTag }: { close: () => void; fromTag?: string }) {
  const [name, setName] = useState(fromTag ? fromTag.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "");
  const [problem, setProblem] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setProblem(null);
    try {
      const team = await createTeam(name, fromTag);
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      close();
      await navigate({ to: "/t/$slug", params: { slug: team.slug } });
    } catch (err) {
      setProblem(messageOf(err));
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {fromTag && <p>Every retro tagged #{fromTag} that isn't in a team yet will join it.</p>}
      <TextField value={name} onChange={setName} isRequired autoFocus className="flex flex-col gap-1">
        <Label className="font-bold">Team name</Label>
        <Input className={input} placeholder="Platform" />
      </TextField>
      {problem && (
        <p role="alert" className="bg-alert px-3 py-2 font-semibold">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" className={button.solid}>
          Make the team
        </Button>
        <Button onPress={close} className={button.quiet}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
