export const button = {
  solid:
    "inline-flex min-h-12 items-center justify-center gap-2 bg-ink px-5 font-bold text-paper outline-offset-2 transition-[translate,box-shadow] duration-100 hover:shadow-[3px_3px_0_var(--color-pink)] data-pressed:translate-x-[3px] data-pressed:translate-y-[3px] data-pressed:shadow-none disabled:opacity-60 disabled:shadow-none",
  line: "inline-flex min-h-11 items-center justify-center gap-2 border-[2.5px] border-ink px-4 font-semibold text-ink outline-offset-2 hover:bg-blue-tint data-pressed:translate-y-px disabled:opacity-60",
  quiet:
    "inline-flex min-h-11 items-center justify-center gap-2 px-3 font-semibold text-ink underline-offset-4 hover:underline data-pressed:translate-y-px",
};

export const input =
  "block min-h-12 w-full border-[1.5px] border-ink-soft bg-paper px-3 text-lg text-ink placeholder:text-ink-soft focus:border-ink focus:shadow-[inset_0_0_0_1px_var(--color-ink)] data-invalid:border-pink";

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
