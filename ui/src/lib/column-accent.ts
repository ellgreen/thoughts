const accents = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export function accentForIndex(index: number): string {
  return accents[((index % accents.length) + accents.length) % accents.length];
}

export function accentStyle(index: number): React.CSSProperties {
  return { "--accent": accentForIndex(index) } as React.CSSProperties;
}

export function accentForName(name: string): string {
  let hash = 0;

  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }

  return accentForIndex(Math.abs(hash));
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
