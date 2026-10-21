const sizes = {
  sm: "text-[28px]",
  lg: "text-[clamp(64px,14vw,128px)]",
};

export function Wordmark({ size = "sm" }: { size?: keyof typeof sizes }) {
  return (
    <span className={`relative inline-block font-display leading-none ${sizes[size]}`}>
      <span aria-hidden="true" className="absolute top-[0.035em] left-[0.045em] text-pink">
        thoughts
      </span>
      <span className="relative text-blue">thoughts</span>
    </span>
  );
}

export function Mark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 52) / 60} viewBox="0 0 60 52" aria-hidden="true" className="isolate">
      <path
        className="overprint fill-pink"
        d="M6 22c0-9 8-16 18-16s18 7 18 16-8 16-18 16c-2 0-4 0-6-.6L9 42l2.5-7.5C8 31.6 6 27 6 22z"
      />
      <path
        className="overprint fill-blue"
        d="M54 28c0-8.3-7.6-15-17-15s-17 6.7-17 15 7.6 15 17 15c1.8 0 3.6-.2 5.3-.7L50 47l-2.2-7.4C51.6 37 54 32.8 54 28z"
      />
    </svg>
  );
}
