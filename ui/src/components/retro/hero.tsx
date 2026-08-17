import { spring } from "@/lib/motion";
import {
  animate,
  m,
  useInView,
  useMotionValue,
  useTransform,
} from "motion/react";
import { useEffect, useRef } from "react";
import {
  CheckSquareIcon,
  FileDownIcon,
  SparklesIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";

interface HeroStats {
  retro_count: number;
  note_count: number;
  task_count: number;
}

const features = [
  { icon: ZapIcon, label: "Real-time" },
  { icon: UsersIcon, label: "Collaborative" },
  { icon: SparklesIcon, label: "AI-powered" },
  { icon: CheckSquareIcon, label: "Task tracking" },
  { icon: FileDownIcon, label: "Markdown export" },
];

const stats = [
  { key: "retro_count", label: "retrospectives", accent: "var(--chart-1)" },
  { key: "note_count", label: "thoughts", accent: "var(--chart-2)" },
  { key: "task_count", label: "actions", accent: "var(--chart-4)" },
] as const;

export default function Hero({ stats: values }: { stats: HeroStats }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-surface px-6 py-7 ring-1 ring-border/60 sm:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-20 size-72 rounded-full bg-[var(--chart-1)]/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -bottom-24 size-64 rounded-full bg-[var(--chart-2)]/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 right-1/4 size-56 rounded-full bg-[var(--chart-4)]/10 blur-3xl"
      />

      <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-4">
          <h1
            className="text-2xl font-bold tracking-tight sm:text-3xl"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
          >
            Better retrospectives,
            <span className="text-muted-foreground"> together.</span>
          </h1>

          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {features.map(({ icon: Icon, label }, i) => (
              <m.span
                key={label}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: 0.05 + i * 0.04 }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <Icon className="size-3 opacity-70" />
                {label}
              </m.span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-8">
          {stats.map((stat) => (
            <Stat
              key={stat.key}
              value={values[stat.key]}
              label={stat.label}
              accent={stat.accent}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  accent,
}: {
  value: number;
  label: string;
  accent: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v).toLocaleString());

  useEffect(() => {
    if (!inView) return;

    const controls = animate(count, value, { duration: 0.9, ease: "easeOut" });

    return () => controls.stop();
  }, [inView, value, count]);

  return (
    <div ref={ref} className="flex flex-col items-center gap-1 text-center">
      <m.div
        className="text-3xl font-black tracking-tight tabular-nums sm:text-4xl"
        style={{ color: accent }}
      >
        {rounded}
      </m.div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
