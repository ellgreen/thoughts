import {
  ZapIcon,
  UsersIcon,
  FileDownIcon,
  SparklesIcon,
  CheckSquareIcon,
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

export default function Hero({ stats }: { stats: HeroStats }) {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card px-8 py-8">
      {/* Wispy background orbs */}
      <div className="pointer-events-none absolute -top-20 -left-20 size-72 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-10 size-64 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute top-0 right-1/4 size-56 rounded-full bg-sky-400/10 blur-2xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 size-40 rounded-full bg-rose-400/8 blur-2xl" />

      <div className="relative flex items-center justify-between gap-10">
        {/* Left: tagline + features */}
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground max-w-xs">
            A simple tool for running better retrospectives with your team.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {features.map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="size-3 opacity-70" />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Right: stats */}
        <div className="flex items-center gap-8 shrink-0">
          <Stat
            value={stats.retro_count}
            label="retrospectives"
            gradient="from-violet-400 to-primary"
          />
          <Stat
            value={stats.note_count}
            label="notes"
            gradient="from-sky-400 to-primary"
          />
          <Stat
            value={stats.task_count}
            label="tasks"
            gradient="from-rose-400 to-primary"
          />
        </div>
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  gradient,
}: {
  value: number;
  label: string;
  gradient: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div
        className={`text-4xl font-black tracking-tight tabular-nums bg-linear-to-br ${gradient} bg-clip-text text-transparent`}
      >
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
