import { twMerge } from "tailwind-merge";

/**
 * Shared page gutter. The nav is sticky and sits above every page, so it and
 * the content beneath it have to agree on width or they visibly misalign on
 * wide screens.
 */
export default function Container({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={twMerge(
        "mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8",
        className,
      )}
      {...props}
    />
  );
}
