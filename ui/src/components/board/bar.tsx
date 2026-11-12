import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { Button, Menu, MenuItem, MenuTrigger, Popover, Tooltip, TooltipTrigger, type Key } from "react-aria-components";
import { useSignOut } from "@/components/account-menu";
import { Mark } from "@/components/brand";
import { IconButton } from "@/components/icon-button";
import { Icon } from "@/components/icons";
import { move, pass, thud } from "@/components/motion";
import { popover } from "@/components/menu";
import { button, initials } from "@/components/ui";
import { Kbd, useShortcuts } from "@/keys/keys";
import { stages, type Stage } from "@/lib/retro";
import type { Status } from "@/lib/socket";
import { setTheme, useShowing } from "@/lib/theme";
import { useChanges, type StageChange } from "./changes";
import { useBoard } from "./context";
import { Timer } from "./timer";

type Props = { status: Status; onSettings: () => void; onStage: (to: Stage) => void };

export function Bar({ status, onSettings, onStage }: Props) {
  const { board, people } = useBoard();
  const r = board.retro;
  const at = stages.findIndex((s) => s.id === r.stage);
  const next = stages[at + 1];
  const ready = people.filter((p) => board.ready.includes(p.id)).length;
  const everyone = people.length > 0 && ready === people.length;

  return (
    <header className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-b-[2.5px] border-ink bg-paper px-4 py-1.5 sm:-mx-6 sm:px-6">
      <div className="order-1 flex min-w-0 flex-1 items-center gap-1">
        <Link to="/" aria-label="thoughts, home" className="inline-flex size-11 shrink-0 items-center justify-center">
          <Mark size={30} />
        </Link>
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate font-display text-2xl leading-tight" style={{ viewTransitionName: `retro-${r.id}` }}>
            {r.title}
          </h1>
          {(r.tags.length > 0 || board.team) && (
            <p className="hidden gap-x-2 truncate text-[13px] leading-tight font-semibold text-ink-soft lg:flex">
              {board.team && (
                <a href={`/t/${board.team.slug}`} className="hover:underline">
                  {board.team.name}
                </a>
              )}
              {r.tags.map((t) => (
                <a key={t} href={`/tags/${encodeURIComponent(t)}`} className="hover:underline">
                  #{t}
                </a>
              ))}
            </p>
          )}
        </div>
      </div>

      <div className="order-3 flex w-full items-center justify-between gap-4 lg:order-2 lg:w-auto">
        <Stepper at={at} onStage={onStage} />
        {next && (
          <Button onPress={() => onStage(next.id)} className={`${button.solid} relative min-h-11 px-4 text-sm whitespace-nowrap`}>
            {next.next}
            {everyone && <span className="hidden xl:inline">· everyone's done</span>}
            <Kbd keys="]" />
            <span aria-hidden="true" className="absolute bottom-0 left-0 h-1 bg-pink transition-[width] duration-200" style={{ width: `${people.length ? (ready / people.length) * 100 : 0}%` }} />
          </Button>
        )}
      </div>

      <div className="order-2 flex items-center gap-1 lg:order-3">
        <Timer />
        <Presence status={status} />
        <More onSettings={onSettings} />
      </div>
      <StageBand />
    </header>
  );
}

const label = (id: string) => stages.find((s) => s.id === id)?.label ?? id;

function StageBand() {
  const change = useChanges().stage;
  return (
    <>
      <span className="sr-only" aria-live="polite">
        {change ? `${label(change.to)} stage` : ""}
      </span>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-full overflow-hidden">
        {change && <Band key={change.n} change={change} />}
      </div>
    </>
  );
}

function Band({ change }: { change: StageChange }) {
  const [done, setDone] = useState(() => document.hidden);
  if (done) return null;
  const back = stages.findIndex((s) => s.id === change.to) < stages.findIndex((s) => s.id === change.from);
  const [from, to] = back ? ["100%", "-100%"] : ["-100%", "100%"];
  return (
    <motion.div
      initial={{ x: from }}
      animate={{ x: [from, "0%", "0%", to] }}
      transition={{ duration: pass, times: [0, 0.25 / pass, 0.45 / pass, 1], ease: "easeInOut" }}
      onAnimationComplete={() => setDone(true)}
      className="bg-ink py-2 text-center font-display text-3xl text-paper"
    >
      {label(change.to)}
    </motion.div>
  );
}

function Stepper({ at, onStage }: { at: number; onStage: (to: Stage) => void }) {
  return (
    <nav aria-label="Stages">
      <ol className="flex items-center">
        {stages.map((s, i) => (
          <li key={s.id} className="flex items-center">
            {i > 0 && <span aria-hidden="true" className={`mx-1.5 h-[2px] w-3 sm:w-4 ${i <= at ? "bg-ink" : "bg-line"}`} />}
            {i === at ? (
              <span aria-current="step" className="bg-ink px-2.5 py-1 text-sm font-bold text-paper">
                {s.label}
              </span>
            ) : i === at - 1 ? (
              <Button
                onPress={() => onStage(s.id)}
                aria-label={`${s.label}, go back to this stage`}
                className="inline-flex min-h-11 items-center gap-1 px-1 text-sm font-semibold text-ink-soft underline-offset-4 hover:underline"
              >
                {s.label} <Kbd keys="[" />
              </Button>
            ) : (
              <>
                <span aria-hidden="true" className={`size-2 sm:hidden ${i < at ? "bg-ink-soft" : "border-[1.5px] border-ink-soft"}`} />
                <span className={`px-1 text-sm font-semibold max-sm:sr-only ${i < at ? "text-ink-soft" : ""}`}>{s.label}</span>
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Presence({ status }: { status: Status }) {
  const { people, board } = useBoard();
  if (status !== "open") {
    return (
      <span role="status" className="bg-alert px-2 py-1 text-sm font-semibold whitespace-nowrap">
        {status === "reconnecting" ? "Reconnecting…" : "Connecting…"}
      </span>
    );
  }
  const checking = board.retro.stage !== "discuss";
  const ready = new Set(board.ready);
  const names = (list: typeof people) => list.map((p) => p.name).join(", ");
  const done = people.filter((p) => ready.has(p.id));
  const going = people.filter((p) => !ready.has(p.id));

  return (
    <TooltipTrigger delay={200}>
      <Button aria-label={`${people.length} here: ${names(people)}`} className="flex min-h-11 items-center gap-2 px-1">
        <span className="flex max-sm:hidden" aria-hidden="true">
          <AnimatePresence initial={false}>
            {people.slice(0, 5).map((p, i) => (
              <motion.span
                key={p.id}
                layout="position"
                initial={{ x: 12, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={move}
                className={`relative flex size-8 items-center justify-center rounded-stamp text-xs font-bold text-ink ring-2 ring-paper ${i % 2 ? "bg-blue-tint" : "bg-pink-tint"}`}
                style={{ marginLeft: i ? -8 : 0 }}
              >
                {initials(p.name)}
                <AnimatePresence initial={false}>
                  {checking && ready.has(p.id) && (
                    <motion.span
                      initial={{ scale: 1.5 }}
                      animate={{ scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={thud}
                      className="absolute -right-0.5 -bottom-0.5 size-3 rounded-stamp bg-pink ring-2 ring-paper"
                    />
                  )}
                </AnimatePresence>
              </motion.span>
            ))}
          </AnimatePresence>
        </span>
        <Icon name="people" className="size-5 sm:hidden" />
        <span className="text-sm font-semibold whitespace-nowrap">
          {people.length}
          <span className="max-sm:hidden"> here</span>
        </span>
      </Button>
      <Tooltip offset={6} className="flex max-w-xs flex-col gap-1 border-[1.5px] border-ink bg-paper px-3 py-2 text-sm text-ink">
        {!checking || done.length === 0 ? (
          <span>{names(people) || "Nobody else yet"}</span>
        ) : (
          <>
            <span>
              <b>Done:</b> {names(done)}
            </span>
            {going.length > 0 && (
              <span>
                <b>Still going:</b> {names(going)}
              </span>
            )}
          </>
        )}
      </Tooltip>
    </TooltipTrigger>
  );
}

const item = "flex min-h-11 cursor-default items-center justify-between gap-4 px-4 font-semibold outline-none data-focused:bg-blue-tint";

function More({ onSettings }: { onSettings: () => void }) {
  const { board } = useBoard();
  const shortcuts = useShortcuts();
  const signOut = useSignOut();
  const to = useShowing() === "dark" ? "light" : "dark";

  function act(key: Key) {
    if (key === "settings") onSettings();
    if (key === "shortcuts") shortcuts.find((s) => s.id === "help")?.run();
    if (key === "theme") setTheme(to);
    if (key === "signout") signOut();
  }

  return (
    <MenuTrigger>
      <IconButton icon="more" label="Retro menu" />
      <Popover placement="bottom end" className={popover}>
        <Menu aria-label="Retro menu" className="flex min-w-52 flex-col outline-none" onAction={act}>
          {board.retro.stage !== "reflect" && (
            <MenuItem id="export" href={`/api/retros/${board.retro.id}/export.md`} download className={item}>
              Export as Markdown
            </MenuItem>
          )}
          <MenuItem id="settings" className={item}>
            Settings
          </MenuItem>
          <MenuItem id="shortcuts" className={`${item} pointer-coarse:hidden`}>
            Keyboard shortcuts <Kbd keys="?" />
          </MenuItem>
          <MenuItem id="theme" className={item}>
            Use the {to} theme
          </MenuItem>
          <MenuItem id="signout" className={item}>
            Sign out
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
