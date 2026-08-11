import { cn } from "@/lib/utils";

export function NoteSkeletons({ count = 2 }: { count?: number }) {
  const heights = [64, 88, 72, 96];

  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg bg-muted/60"
          style={{ height: heights[i % heights.length] }}
        />
      ))}
    </div>
  );
}

export function EmptyColumn({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-border/70 px-3 py-6 text-center",
        "text-sm text-muted-foreground/70",
        className,
      )}
    >
      {children}
    </div>
  );
}
