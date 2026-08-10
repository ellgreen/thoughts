/**
 * Column accents are derived from position, not stored, so no migration and no
 * change to the creation form. Five hues cover the maximum column count.
 *
 * Once notes are grouped and reordered by vote, colour is the only thing left
 * that says which column a thought came from.
 */
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

/**
 * CSS custom property carrying a column's accent. Set it on the column and
 * anything inside can reach it with `[color:var(--accent)]` and friends,
 * without threading a prop through every child.
 */
export function accentStyle(index: number): React.CSSProperties {
  return { "--accent": accentForIndex(index) } as React.CSSProperties;
}

/** Deterministic accent for a person, used for author initials. */
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
