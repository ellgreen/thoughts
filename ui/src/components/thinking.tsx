import { useEffect, useState } from "react";

const line = "M2 12c3-7 6-9 7-5s-2 7 1 6 5-9 8-8-1 8 2 8 5-8 8-7-1 7 2 7 4-5 6-6";

function Scribble() {
  return (
    <svg viewBox="0 0 40 18" className="h-[18px] w-10 shrink-0 fill-none stroke-[2.5] [stroke-linecap:round] [stroke-linejoin:round]" aria-hidden="true">
      <path d={line} pathLength={1} className="translate-x-[1.5px] translate-y-[1.5px] stroke-pink [animation:scribble_1.8s_ease-in-out_-0.12s_infinite] [stroke-dasharray:1_1] motion-reduce:[animation:none]" />
      <path d={line} pathLength={1} className="stroke-blue [animation:scribble_1.8s_ease-in-out_infinite] [stroke-dasharray:1_1] motion-reduce:[animation:none]" />
    </svg>
  );
}

export function Thinking({ label }: { label: string }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const tick = window.setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(tick);
  }, []);

  return (
    <span className="inline-flex items-center gap-2">
      <Scribble />
      <span role="status">{label}</span>
      {seconds >= 3 && (
        <span aria-hidden="true" className="font-normal text-ink-soft tabular-nums">
          {seconds}s
        </span>
      )}
    </span>
  );
}
