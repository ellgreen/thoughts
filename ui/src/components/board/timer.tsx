import { useEffect, useRef, useState } from "react";
import { Menu, MenuItem, MenuTrigger, Popover, type Key } from "react-aria-components";
import { IconButton } from "@/components/icon-button";
import { popover } from "@/components/menu";
import { Kbd, useShortcut } from "@/keys/keys";
import { useBoard } from "./context";

const presets = [2, 3, 5, 10];
const item = "flex min-h-11 cursor-default items-center justify-between gap-4 px-4 font-semibold outline-none data-focused:bg-blue-tint";

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

// Timer draws its burn-down rule along the bottom edge of the nearest
// positioned ancestor, which is the bar.
export function Timer() {
  const { board, run } = useBoard();
  const { endsAt, left } = board.timer;
  // Count against the server's clock: a laptop a minute fast would otherwise
  // show everyone a different time.
  const offset = board.clockOffset ?? 0;
  const [now, setNow] = useState(() => Date.now());
  const [sound, setSound] = useState(readChime);
  const [menuOpen, setMenuOpen] = useState(false);
  const wasRunning = useRef(false);
  const [total, setTotal] = useState(0);

  const running = !!endsAt;
  const remaining = endsAt ? Math.max(0, Date.parse(endsAt) - (now + offset)) : (left ?? 0) * 1000;
  const done = running && remaining === 0;
  const active = running || (left ?? 0) > 0;

  // The board carries no total, so the longest time seen since the timer
  // started stands in for it.
  const longest = active ? Math.max(total, remaining) : 0;
  if (longest !== total) setTotal(longest);

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

  function act(key: Key) {
    const k = String(key);
    if (k === "toggle") run(running ? "timer.pause" : "timer.resume");
    else if (k === "add") run("timer.add", { seconds: 60 });
    else if (k === "clear") run("timer.clear");
    else if (k === "chime") toggleSound(!sound);
    else run("timer.start", { seconds: Number(k) * 60 });
  }

  const counting = active && !done;

  return (
    <div className="flex items-center" role="group" aria-label="Timer">
      {active && (
        <span role="timer" aria-live={done ? "assertive" : "off"} className={`font-display leading-none tabular-nums ${done ? "text-lg max-sm:text-2xl" : "text-2xl"} ${running ? "" : "opacity-60"}`}>
          {done ? (
            <>
              <span className="max-sm:sr-only">Time's up</span>
              <span className="sm:hidden" aria-hidden="true">
                0:00
              </span>
            </>
          ) : (
            format(remaining)
          )}
        </span>
      )}
      <MenuTrigger isOpen={menuOpen} onOpenChange={setMenuOpen}>
        <IconButton icon="clock" label="Timer" keys="t" />
        <Popover placement="bottom end" className={popover}>
          <Menu aria-label="Timer" className="flex min-w-44 flex-col outline-none" onAction={act}>
            {counting && (
              <MenuItem id="toggle" className={item}>
                {running ? "Pause" : "Resume"} <Kbd keys="t" />
              </MenuItem>
            )}
            {counting && (
              <MenuItem id="add" className={item}>
                +1 min
              </MenuItem>
            )}
            {!counting &&
              presets.map((m) => (
                <MenuItem key={m} id={String(m)} className={item}>
                  {m} minutes
                </MenuItem>
              ))}
            {active && (
              <MenuItem id="clear" className={item}>
                Clear
              </MenuItem>
            )}
            <MenuItem id="chime" className={item}>
              {sound ? "Chime is on" : "Chime is off"}
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      {counting && longest > 0 && (
        <span aria-hidden="true" className="absolute -bottom-[2.5px] left-0 h-[3px] bg-pink transition-[width] duration-300 ease-linear" style={{ width: `${(remaining / longest) * 100}%` }} />
      )}
    </div>
  );
}
