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
    <section aria-labelledby="teams" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="teams" className="font-display text-3xl">
          Teams
        </h2>
        <Button onPress={() => setCreating(true)} className={button.quiet}>
          New team
        </Button>
      </div>
      {teams.length === 0 ? (
        <p className="max-w-[56ch] text-ink-soft">
          A team keeps its retros together, and each new retro opens with the actions the last one left unfinished.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {teams.map((t) => (
            <li key={t.id}>
              <Link to="/t/$slug" params={{ slug: t.slug }} className="flex min-h-12 flex-col justify-center bg-blue-tint px-4 py-2 hover:bg-pink-tint">
                <span className="font-display text-xl leading-tight">{t.name}</span>
                <span className="text-sm">
                  {t.retros} {t.retros === 1 ? "retro" : "retros"}
                  {t.openActions > 0 && `, ${t.openActions} still to do`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <NewTeam isOpen={creating} onOpenChange={setCreating} />
    </section>
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
