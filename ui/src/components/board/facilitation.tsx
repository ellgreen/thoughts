import { useEffect, useRef, useState } from "react";
import { Button, Menu, MenuItem, MenuTrigger, Popover, ToggleButton } from "react-aria-components";
import { button } from "@/components/ui";
import { Kbd, useShortcut } from "@/keys/keys";
import { formatDueOn } from "@/lib/retro";
import { useBoard } from "./context";

const presets = [2, 3, 5, 10];

function format(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function readChime() {
  try {
    return localStorage.getItem("thoughts.chime") !== "off";
  } catch {
    return true;
  }
}

// chime plays two soft notes without shipping an audio file.
function chime() {
  try {
    const ctx = new AudioContext();
    for (const [i, freq] of [660, 880].entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.25);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + i * 0.25 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.25 + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.25);
      osc.stop(ctx.currentTime + i * 0.25 + 0.7);
    }
  } catch {
    // No audio is fine; the timer still shows zero.
  }
}

export function Timer() {
  const { board, run } = useBoard();
  const { endsAt, left } = board.timer;
  // Count against the server's clock: a laptop a minute fast would otherwise
  // show everyone a different time.
  const offset = board.clockOffset ?? 0;
  const [now, setNow] = useState(() => Date.now());
  const [sound, setSound] = useState(readChime);
  const wasRunning = useRef(false);

  const running = !!endsAt;
  const remaining = endsAt ? Math.max(0, Date.parse(endsAt) - (now + offset)) : (left ?? 0) * 1000;
  const done = running && remaining === 0;

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (running && remaining > 0) wasRunning.current = true;
    if (done && wasRunning.current) {
      wasRunning.current = false;
      if (sound) chime();
    }
  }, [running, remaining, done, sound]);

  const [menuOpen, setMenuOpen] = useState(false);
  useShortcut({
    id: "timer",
    keys: "t",
    label: "Start or pause the timer",
    section: "Retro",
    run: () => {
      if (running && !done) run("timer.pause");
      else if (left) run("timer.resume");
      else setMenuOpen(true);
    },
  });

  function toggleSound(on: boolean) {
    setSound(on);
    try {
      localStorage.setItem("thoughts.chime", on ? "on" : "off");
    } catch {
      // Remembering is a nicety.
    }
  }

  const active = running || (left ?? 0) > 0;

  return (
    <div className="ml-auto flex flex-wrap items-center gap-2" role="group" aria-label="Timer">
      {active && (
        <span
          role="timer"
          aria-live={done ? "assertive" : "off"}
          className={`min-w-[4ch] font-display text-3xl leading-none tabular-nums ${done ? "text-pink" : ""}`}
        >
          {done ? "Time's up" : format(remaining)}
        </span>
      )}
      {!active || done ? (
        <MenuTrigger isOpen={menuOpen} onOpenChange={setMenuOpen}>
          <Button className={button.quiet}>
            {done ? "Start again" : "Timer"} <Kbd keys="t" />
          </Button>
          <Popover className="border-[2.5px] border-ink bg-paper">
            <Menu aria-label="Timer length" className="flex flex-col outline-none" onAction={(k) => run("timer.start", { seconds: Number(k) * 60 })}>
              {presets.map((m) => (
                <MenuItem key={m} id={String(m)} className="flex min-h-11 cursor-default items-center px-4 font-semibold outline-none data-focused:bg-blue-tint">
                  {m} minutes
                </MenuItem>
              ))}
            </Menu>
          </Popover>
        </MenuTrigger>
      ) : (
        <Button onPress={() => run(running ? "timer.pause" : "timer.resume")} className={button.quiet}>
          {running ? "Pause" : "Resume"} <Kbd keys="t" />
        </Button>
      )}
      {active && (
        <>
          <Button onPress={() => run("timer.add", { seconds: 60 })} className={button.quiet}>
            +1 min
          </Button>
          <Button onPress={() => run("timer.clear")} className={button.quiet} aria-label="Clear the timer">
            Clear
          </Button>
          <ToggleButton isSelected={sound} onChange={toggleSound} className={button.quiet} aria-label="Chime when time's up">
            {sound ? "Chime on" : "Chime off"}
          </ToggleButton>
        </>
      )}
    </div>
  );
}

export function ReadyCheck() {
  const { board, people, me, run } = useBoard();
  const ready = new Set(board.ready);
  const mine = ready.has(me);
  const here = people.filter((p) => ready.has(p.id)).length;
  const discussing = board.retro.stage === "discuss";
  useShortcut({ id: "ready", keys: "d", label: "Say you're done with this stage", section: "Retro", run: () => run("ready.set", { ready: !mine }) }, !discussing);
  const waiting = people.filter((p) => !ready.has(p.id)).map((p) => p.name);
  if (discussing) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ToggleButton
        isSelected={mine}
        onChange={(on) => run("ready.set", { ready: on })}
        className={`${button.line} data-selected:bg-ink data-selected:text-paper`}
      >
        {mine ? "Done" : "I'm done"} <Kbd keys="d" />
      </ToggleButton>
      <span className="text-sm font-semibold" aria-live="polite" title={waiting.length ? `Still going: ${waiting.join(", ")}` : undefined}>
        {here} of {people.length} done
      </span>
    </div>
  );
}

export function LastTime() {
  const { board, run } = useBoard();
  if (board.lastTime.length === 0) return null;
  return (
    <section aria-labelledby="last-time" className="flex flex-col gap-2 border-[2.5px] border-ink p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="last-time" className="font-display text-2xl leading-tight">
          From last time
        </h2>
        <span className="text-sm text-ink-soft">Still open from earlier {board.team?.name} retros. Settle each one.</span>
      </div>
      <ul className="flex flex-col">
        {board.lastTime.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t-[1.5px] border-blue-tint py-2">
            <span className="min-w-0 flex-[1_1_16rem]">
              <span className="font-semibold">{a.what}</span>
              <span className="block text-sm text-ink-soft">{[a.who, a.dueOn && `by ${formatDueOn(a.dueOn)}`, `from ${a.retroTitle}`].filter(Boolean).join(" · ")}</span>
            </span>
            <span className="flex gap-1">
              <Button onPress={() => run("lastTime.close", { id: a.id, outcome: "done" })} className={button.quiet}>
                Done
              </Button>
              <Button onPress={() => run("lastTime.close", { id: a.id, outcome: "carried" })} className={button.quiet}>
                Carry over
              </Button>
              <Button onPress={() => run("lastTime.close", { id: a.id, outcome: "dropped" })} className={button.quiet}>
                Drop
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
