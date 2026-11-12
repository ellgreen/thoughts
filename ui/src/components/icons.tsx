const paths = {
  sun: "M10 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4",
  moon: "M16.5 11.8A7 7 0 1 1 8.2 3.5a5.5 5.5 0 0 0 8.3 8.3z",
  clock: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM10 6v4l2.5 2",
  more: "M4 10h.01M10 10h.01M16 10h.01",
  plus: "M10 4v12M4 10h12",
  check: "M4 10.5l4 4 8-9",
  target: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM10 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
  image: "M3 4.5h14v11H3zM3 13l4-4 3.5 3.5 2.5-2.5 4 4M12.5 7.5h.01",
  pencil: "M4 16l1-4 8.5-8.5 3 3L8 15zM12 5l3 3",
  trash: "M4 6h12M8 6V4h4v2M5.5 6l.7 10h7.6l.7-10",
  arrowLeft: "M16 10H4M9 5l-5 5 5 5",
  arrowRight: "M4 10h12M11 5l5 5-5 5",
  close: "M5 5l10 10M15 5L5 15",
  people: "M7.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM2.5 16c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5M13 4.2a2.5 2.5 0 0 1 0 4.6M14.5 11.8c1.8.5 3 2 3 4.2",
  export: "M10 3v9M6.5 8.5L10 12l3.5-3.5M4 14v2.5h12V14",
  settings: "M3 6h8M15 6h2M3 14h2M9 14h8M13 4v4M7 12v4",
  keyboard: "M2.5 5.5h15v9h-15zM5.5 8.5h.01M8.5 8.5h.01M11.5 8.5h.01M14.5 8.5h.01M6.5 11.5h7",
};

export type IconName = keyof typeof paths;

const dotted: IconName[] = ["more"];

export function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`shrink-0 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] ${dotted.includes(name) ? "stroke-[3]" : "stroke-[1.8]"} ${className}`}
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
